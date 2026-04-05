import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'

export default defineEventHandler(async (event) => {
  try {
    const pb = await getAuthenticatedPocketBase()
    const questionId = getRouterParam(event, 'id')

    if (!questionId) {
      throw createError({
        statusCode: 400,
        message: 'Question ID is required'
      })
    }

    console.log('📋 Fetching question:', questionId)

    // Fetch the question using admin auth (without expand to avoid issues)
    const record = await pb.collection('questions').getOne(questionId)

    console.log('✅ Found question:', record.id)
    console.log('📝 Question has responses:', !!record.responses)
    console.log('📝 Responses type:', typeof record.responses)
    
    // Ensure responses is properly formatted
    if (record.responses) {
      if (typeof record.responses === 'string') {
        try {
          record.responses = JSON.parse(record.responses)
        } catch (e) {
          console.warn('⚠️  Failed to parse responses JSON:', e)
          record.responses = {}
        }
      }
    } else {
      record.responses = {}
    }

    return record
  } catch (error: any) {
    console.error('Error fetching question:', error)
    
    // If it's already an H3 error, re-throw it
    if (error.statusCode) {
      throw error
    }
    
    // Extract detailed error message from PocketBase
    let errorMessage = 'Failed to fetch question'
    
    if (error.data) {
      if (typeof error.data === 'string') {
        errorMessage = error.data
      } else if (error.data.message) {
        errorMessage = error.data.message
      } else {
        errorMessage = JSON.stringify(error.data)
      }
    } else if (error.message) {
      errorMessage = error.message
    }
    
    throw createError({
      statusCode: error.status || 500,
      message: errorMessage
    })
  }
})

