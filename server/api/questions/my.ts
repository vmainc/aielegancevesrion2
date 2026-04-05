import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'

export default defineEventHandler(async (event) => {
  try {
    const pb = await getAuthenticatedPocketBase()
    
    // Verify admin authentication is working
    try {
      const authData = pb.authStore.model
      if (!authData || !authData.id) {
        console.warn('⚠️  Admin authentication may not be active')
      } else {
        console.log('✅ Admin authenticated, admin ID:', authData.id)
      }
    } catch (authCheckError) {
      console.warn('⚠️  Could not verify admin auth:', authCheckError)
    }
    
    const query = getQuery(event)
    const userId = query.userId as string

    if (!userId) {
      throw createError({
        statusCode: 400,
        message: 'User ID is required'
      })
    }

    console.log('📋 Fetching questions for user:', userId)
    
    // Check if collection exists first
    try {
      const collection = await pb.collections.getOne('questions')
      console.log('✅ Questions collection found')
    } catch (collectionError: any) {
      console.error('❌ Collection check failed:', collectionError)
      const errorMsg = collectionError.message || collectionError.response?.message || 'Unknown error'
      throw createError({
        statusCode: 500,
        message: `Questions collection not found or not accessible: ${errorMsg}`
      })
    }

    // Try using getFullList which might work better with admin auth
    console.log('🔍 Fetching all questions and filtering client-side...')
    
    try {
      // Try getFullList with minimal parameters first (no sort, no expand)
      console.log('   Attempting getFullList with minimal parameters...')
      const allRecords = await pb.collection('questions').getFullList()
      
      console.log('✅ Fetched all records:', allRecords.length)
      
      // Filter by user ID - handle both string IDs and expanded objects
      const userQuestions = allRecords.filter((item: any) => {
        const userValue = typeof item.user === 'string' 
          ? item.user 
          : (item.user?.id || item.user)
        const matches = userValue === userId
        if (matches) {
          console.log('   Found matching question:', item.id, '- user:', userValue)
        }
        return matches
      })
      
      console.log('✅ Found questions for user:', userQuestions.length)
      
      return {
        page: 1,
        perPage: userQuestions.length,
        totalItems: userQuestions.length,
        totalPages: 1,
        items: userQuestions
      }
    } catch (fullListError: any) {
      console.warn('⚠️  getFullList failed, trying getList:', fullListError.message)
      
      // Fallback to getList with minimal parameters
      try {
        console.log('   Attempting getList with minimal parameters...')
        const allRecords = await pb.collection('questions').getList(1, 500)
        
        console.log('✅ Fetched records with getList:', allRecords.items.length)
        
        // Filter by user ID
        const userQuestions = allRecords.items.filter((item: any) => {
          const userValue = typeof item.user === 'string' 
            ? item.user 
            : (item.user?.id || item.user)
          return userValue === userId
        })
        
        console.log('✅ Found questions for user:', userQuestions.length)
        
        return {
          ...allRecords,
          items: userQuestions,
          totalItems: userQuestions.length
        }
      } catch (listError: any) {
        console.error('❌ Both getFullList and getList failed')
        console.error('List error:', listError.message)
        console.error('List error details:', JSON.stringify(listError, null, 2))
        
        // If both fail, it's likely an access rules issue
        throw createError({
          statusCode: 500,
          message: `Cannot query questions collection. This may be due to access rules. Error: ${listError.message}. Please check PocketBase collection access rules for the 'questions' collection.`
        })
      }
    }
  } catch (error: any) {
    console.error('Error fetching user questions:', error)
    
    // If it's already an H3 error, re-throw it
    if (error.statusCode) {
      throw error
    }
    
    // Extract detailed error message from PocketBase
    let errorMessage = 'Failed to fetch questions'
    let errorDetails: any = {}
    
    // Try to get detailed error information
    if (error.response) {
      errorDetails.response = error.response
      errorMessage = `PocketBase response error: ${JSON.stringify(error.response)}`
    }
    
    if (error.data) {
      errorDetails.data = error.data
      if (typeof error.data === 'string') {
        errorMessage = error.data
      } else if (error.data.message) {
        errorMessage = error.data.message
      } else if (error.data.data?.message) {
        errorMessage = error.data.data.message
      } else {
        errorMessage = JSON.stringify(error.data)
      }
    }
    
    if (error.message) {
      errorDetails.message = error.message
      if (!errorMessage || errorMessage === 'Failed to fetch questions') {
        errorMessage = error.message
      }
    }
    
    // Log full error for debugging
    console.error('Full error object:', JSON.stringify(errorDetails, null, 2))
    console.error('Final error message:', errorMessage)
    
    throw createError({
      statusCode: 500,
      message: errorMessage,
      data: {
        originalError: error.message,
        stack: error.stack
      }
    })
  }
})

