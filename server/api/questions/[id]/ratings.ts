import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'

// Store ratings per user, per model response
// This allows multiple users to rate the same question's answers

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

      // Check if rating already exists
      try {
        const existing = await pb.collection('ratings').getFirstListItem(
          `question = "${questionId}" && user = "${userId}" && model = "${model}"`
        )

        // Update existing rating
        const wasRated = existing.rating > 0
        await pb.collection('ratings').update(existing.id, { rating })

        // Award points only if this is a new rating (wasn't rated before)
        if (!wasRated && rating > 0) {
          try {
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
          pointsAwarded: !wasRated && rating > 0 ? 10 : 0
        }
      } catch {
        // Rating doesn't exist, create new one
        const isNewRating = rating > 0

        await pb.collection('ratings').create({
          question: questionId,
          user: userId,
          model,
          rating
        })

        // Award 10 points for new rating
        if (isNewRating) {
          try {
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
    }

    if (method === 'GET') {
      // Get all ratings for this question, optionally filtered by user
      const query = getQuery(event)
      const userId = query.userId as string | undefined

      let filter = `question = "${questionId}"`
      if (userId) {
        filter += ` && user = "${userId}"`
      }

      let ratings
      try {
        ratings = await pb.collection('ratings').getFullList({
          filter,
          expand: 'user'
        })
      } catch (expandErr: any) {
        console.warn('ratings GET: expand=user failed, retrying:', expandErr?.message)
        ratings = await pb.collection('ratings').getFullList({ filter })
      }

      // Group ratings by model and calculate averages
      const modelRatings: Record<string, { ratings: any[], average: number, count: number, userRating?: number }> = {}

      ratings.forEach((rating: any) => {
        const model = rating.model
        if (!modelRatings[model]) {
          modelRatings[model] = {
            ratings: [],
            average: 0,
            count: 0
          }
        }

        modelRatings[model].ratings.push(rating)
        modelRatings[model].count++

        // Track current user's rating if filtering
        if (userId && rating.user === userId) {
          modelRatings[model].userRating = rating.rating
        }
      })

      // Calculate averages
      Object.keys(modelRatings).forEach(model => {
        const total = modelRatings[model].ratings.reduce((sum, r) => sum + r.rating, 0)
        modelRatings[model].average = modelRatings[model].count > 0
          ? total / modelRatings[model].count
          : 0
      })

      return modelRatings
    }
  } catch (error: any) {
    console.error('Ratings API error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to process rating'
    })
  }
})

