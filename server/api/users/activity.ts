import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'

export default defineEventHandler(async (event) => {
  try {
    const pb = await getAuthenticatedPocketBase()
    const query = getQuery(event)
    const userId = query.userId as string

    if (!userId) {
      throw createError({
        statusCode: 400,
        message: 'User ID is required'
      })
    }

    // Count questions posted by user
    let questionsPosted = 0
    try {
      const questionsResult = await pb.collection('questions').getList(1, 1, {
        filter: `user = "${userId}"`,
        fields: 'id'
      })
      questionsPosted = questionsResult.totalItems
    } catch (error) {
      console.error('Error counting questions:', error)
    }

    // Count answers rated - use the ratings collection instead of iterating questions
    let answersRated = 0
    try {
      // Count ratings made by this user (much more efficient than iterating all questions)
      const ratingsResult = await pb.collection('ratings').getList(1, 1, {
        filter: `user = "${userId}" && rating > 0`,
        fields: 'id'
      })
      answersRated = ratingsResult.totalItems
    } catch (error) {
      console.error('Error counting rated answers:', error)
      // If ratings collection doesn't exist or query fails, try to count from questions as fallback
      // But use pagination to avoid auto-cancellation
      try {
        let page = 1
        const perPage = 50
        let hasMore = true
        let totalRated = 0
        
        while (hasMore) {
          const questionsPage = await pb.collection('questions').getList(page, perPage, {
            filter: `user = "${userId}"`,
            fields: 'responses'
          })
          
          questionsPage.items.forEach((question: any) => {
            let responses = {}
            if (question.responses) {
              if (typeof question.responses === 'string') {
                try {
                  responses = JSON.parse(question.responses || '{}')
                } catch {
                  responses = {}
                }
              } else if (typeof question.responses === 'object') {
                responses = question.responses
              }
            }
            
            // Count how many responses have ratings
            Object.values(responses).forEach((response: any) => {
              if (response && response.rating && response.rating > 0) {
                totalRated++
              }
            })
          })
          
          hasMore = questionsPage.items.length === perPage && page * perPage < questionsPage.totalItems
          page++
          
          // Safety limit to prevent infinite loops
          if (page > 100) break
        }
        
        answersRated = totalRated
      } catch (fallbackError) {
        console.error('Error in fallback rating count:', fallbackError)
      }
    }

    // Comments made (placeholder - not implemented yet)
    const commentsMade = 0

    // Days logged in (placeholder - would need to track login dates)
    const daysLoggedIn = 0

    return {
      questionsPosted,
      answersRated,
      commentsMade,
      daysLoggedIn
    }
  } catch (error: any) {
    console.error('Error fetching user activity:', error)
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to fetch user activity'
    })
  }
})

