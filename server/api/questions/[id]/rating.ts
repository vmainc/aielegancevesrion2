import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'

export default defineEventHandler(async (event) => {
  try {
    const pb = await getAuthenticatedPocketBase()
    const method = getMethod(event)
    const questionId = getRouterParam(event, 'id')

    if (!questionId) {
      throw createError({
        statusCode: 400,
        message: 'Question ID is required'
      })
    }

    if (method === 'POST') {
      const body = await readBody(event)
      const { userId, model, rating } = body

      if (!userId) {
        throw createError({
          statusCode: 400,
          message: 'User ID is required'
        })
      }

      if (!model) {
        throw createError({
          statusCode: 400,
          message: 'Model name is required'
        })
      }

      // Get the question to verify it exists
      await pb.collection('questions').getOne(questionId)

      // Use the new ratings collection for public ratings
      // Check if rating already exists
      let wasRated = false
      let isNewRating = false
      
      try {
        const existing = await pb.collection('ratings').getFirstListItem(
          `question = "${questionId}" && user = "${userId}" && model = "${model}"`
        )
        wasRated = existing.rating > 0
        isNewRating = !wasRated && rating > 0
        
        // Update existing rating
        await pb.collection('ratings').update(existing.id, { rating })
      } catch {
        // Rating doesn't exist, create new one
        isNewRating = rating > 0
        await pb.collection('ratings').create({
          question: questionId,
          user: userId,
          model,
          rating
        })
      }

      // Award 10 points if this is a new rating
      if (isNewRating) {
        try {
          // Get or create user_points record
          let userPointsRecord
          try {
            const records = await pb.collection('user_points').getList(1, 1, {
              filter: `user = "${userId}"`
            })

            if (records.items.length > 0) {
              userPointsRecord = records.items[0]
              await pb.collection('user_points').update(userPointsRecord.id, {
                points: userPointsRecord.points + 10
              })
            } else {
              await pb.collection('user_points').create({
                user: userId,
                points: 10
              })
            }
          } catch (pointsError) {
            console.error('Failed to award points for rating:', pointsError)
          }
        } catch (pointsError) {
          console.error('Failed to award points for rating:', pointsError)
        }
      }

      return {
        success: true,
        rating,
        pointsAwarded: isNewRating ? 10 : 0
      }
    }
  } catch (error: any) {
    console.error('Rating API error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to save rating'
    })
  }
})

