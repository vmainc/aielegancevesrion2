import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'

export default defineEventHandler(async (event) => {
  const pb = await getAuthenticatedPocketBase()
  const method = getMethod(event)

  if (method === 'POST') {
    try {
      const body = await readBody(event)
      const { question, responses, userId } = body

      console.log('Received question save request:', {
        question: question?.substring(0, 50) + '...',
        hasResponses: !!responses,
        responseCount: responses ? Object.keys(responses).length : 0,
        userId: userId
      })

      // Validate required fields
      if (!question || !question.trim()) {
        throw createError({
          statusCode: 400,
          message: 'Question is required'
        })
      }

      if (!userId) {
        throw createError({
          statusCode: 400,
          message: 'User ID is required'
        })
      }

      // Prepare responses - ensure it's a valid object
      let responsesData = {}
      if (responses) {
        if (typeof responses === 'string') {
          try {
            responsesData = JSON.parse(responses)
          } catch {
            responsesData = {}
          }
        } else if (typeof responses === 'object' && responses !== null) {
          responsesData = responses
        }
      }

      console.log('Attempting to create question with data:', {
        question: question.trim().substring(0, 50),
        responsesType: typeof responsesData,
        responsesKeys: Object.keys(responsesData).length,
        userId: userId
      })

      // Create the question record
      // PocketBase JSON fields accept objects directly
      const record = await pb.collection('questions').create({
        question: question.trim(),
        responses: responsesData,
        user: userId
      })

      console.log('Question created successfully:', record.id)
      console.log('Created record has created field:', record.created, 'type:', typeof record.created)
      console.log('Created record keys:', Object.keys(record))

      // Update user points
      await updateUserPoints(pb, userId, 50)

      return record
    } catch (error: any) {
      console.error('Error creating question:', error)
      console.error('Error details:', {
        message: error.message,
        data: error.data,
        response: error.response,
        status: error.status,
        statusCode: error.statusCode
      })
      
      // If it's already a H3 error, re-throw it
      if (error.statusCode) {
        throw error
      }
      
      // Extract detailed error message from PocketBase
      let errorMessage = 'Failed to create question'
      if (error.data) {
        errorMessage = JSON.stringify(error.data)
      } else if (error.response?.data) {
        errorMessage = JSON.stringify(error.response.data)
      } else if (error.message) {
        errorMessage = error.message
      }
      
      // Otherwise wrap it
      throw createError({
        statusCode: 500,
        message: errorMessage
      })
    }
  }

  if (method === 'GET') {
    try {
      const query = getQuery(event)
      
      // Validate and parse page/perPage parameters
      let page = 1
      let perPage = 20
      
      if (query.page) {
        const parsedPage = parseInt(query.page as string)
        if (!isNaN(parsedPage) && parsedPage > 0) {
          page = parsedPage
        }
      }
      
      if (query.perPage) {
        const parsedPerPage = parseInt(query.perPage as string)
        if (!isNaN(parsedPerPage) && parsedPerPage > 0 && parsedPerPage <= 500) {
          perPage = parsedPerPage
        }
      }
      
      console.log('Fetching questions:', { page, perPage })
      
      // Fetch questions - always sort by newest first
      let records
      try {
        // Try sorting by created first, but if that doesn't work, sort by ID (PocketBase IDs contain timestamp info)
        records = await pb.collection('questions').getList(page, perPage, {
          sort: '-created'
        })
        console.log('Questions fetched with -created sort:', records.items?.length || 0, 'items')
        
        // Check if created fields are actually populated
        const hasValidCreated = records.items?.some((item: any) => item.created) || false
        if (!hasValidCreated) {
          console.warn('⚠️ No questions have created timestamps, will sort by ID instead')
          // Re-fetch sorted by ID descending (IDs contain timestamp info, so this approximates newest first)
          records = await pb.collection('questions').getList(page, perPage, {
            sort: '-id'
          })
          console.log('Re-fetched questions sorted by -id:', records.items?.length || 0, 'items')
        }
      } catch (listError: any) {
        console.error('PocketBase getList error:', listError.message)
        // Fallback: fetch without sort and sort by ID manually
        try {
          console.log('Fetching without sort, will sort by ID manually...')
          records = await pb.collection('questions').getList(page, perPage * 2)
          // Sort by ID descending (approximates newest first since IDs contain timestamp info)
          records.items.sort((a: any, b: any) => {
            return b.id.localeCompare(a.id) // Reverse string comparison
          })
          records.items = records.items.slice(0, perPage)
          records.perPage = perPage
          console.log('Questions fetched and sorted by ID:', records.items?.length || 0, 'items')
        } catch (retryError: any) {
          console.error('Retry also failed:', retryError.message)
          throw retryError
        }
      }
      
      // Try to expand users manually (in parallel, but don't fail on errors)
      if (records.items && records.items.length > 0) {
        const userIds = [...new Set(records.items.map(item => item.user).filter(Boolean))]
        
        const userMap = new Map()
        
        // Fetch all users in parallel
        await Promise.allSettled(
          userIds.map(async (userId: string) => {
            try {
              const userRecord = await pb.collection('users').getOne(userId, {
                fields: 'id,email,name'
              })
              userMap.set(userId, userRecord)
            } catch (userError: any) {
              console.warn(`Failed to fetch user ${userId}:`, userError.message)
            }
          })
        )
        
        // Attach users to items (preserve ALL fields including created, id, updated, etc.)
        records.items = records.items.map((item: any) => {
          // Create a new object preserving ALL original fields, especially system fields
          const newItem = {
            ...item, // This preserves all fields including id, created, updated, question, responses, user
            expand: {
              user: userMap.get(item.user) || null
            }
          }
          // Double-check that created is preserved (should be from spread, but be explicit)
          if (item.created === undefined || item.created === null) {
            console.warn('⚠️ Question missing created field:', item.id)
          }
          return newItem
        })
        
        // Re-sort after expansion to ensure proper order
        // IMPORTANT: If created timestamps are null, this is a database configuration issue.
        // PocketBase should automatically set 'created' for all records, but if they're null,
        // the collection may need to be recreated or the field manually configured.
        records.items.sort((a: any, b: any) => {
          const dateA = a.created ? new Date(a.created).getTime() : null
          const dateB = b.created ? new Date(b.created).getTime() : null
          
          if (dateA !== null && dateB !== null) {
            return dateB - dateA // Descending order (newest first)
          } else if (dateA !== null) {
            return -1 // A has date, B doesn't - A comes first
          } else if (dateB !== null) {
            return 1 // B has date, A doesn't - B comes first
          } else {
            // Both are null - sort by ID descending as fallback
            // Note: This is NOT reliable for chronological order, but provides consistent sorting
            return b.id.localeCompare(a.id)
          }
        })
        
        // Log warning if created fields are missing
        if (records.items.length > 0) {
          const itemsWithoutCreated = records.items.filter((item: any) => !item.created)
          if (itemsWithoutCreated.length === records.items.length) {
            console.error(`❌ ERROR: All ${itemsWithoutCreated.length} questions are missing 'created' field!`)
            console.error('This indicates a database configuration issue. The PocketBase collection needs to be fixed.')
            console.error('Questions are being sorted by ID as a fallback, but this is NOT chronological.')
          }
        }
      }
      
      return records
    } catch (error: any) {
      console.error('Error fetching questions:', error)
      console.error('Error details:', {
        message: error.message,
        data: error.data,
        status: error.status,
        statusCode: error.statusCode,
        originalError: error.originalError || error
      })
      
      // Try to get more details from PocketBase error
      let errorMessage = 'Failed to fetch questions'
      if (error.data) {
        errorMessage = JSON.stringify(error.data)
      } else if (error.message) {
        errorMessage = error.message
      } else if (error.originalError?.message) {
        errorMessage = error.originalError.message
      }
      
      throw createError({
        statusCode: error.status || 500,
        message: errorMessage
      })
    }
  }

  throw createError({
    statusCode: 405,
    message: 'Method Not Allowed'
  })
})

async function updateUserPoints(pb: any, userId: string, points: number) {
  try {
    const existing = await pb.collection('user_points').getFirstListItem(`user="${userId}"`)
    await pb.collection('user_points').update(existing.id, {
      points: existing.points + points
    })
  } catch {
    await pb.collection('user_points').create({
      user: userId,
      points
    })
  }
}

