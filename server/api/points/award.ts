import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'

export default defineEventHandler(async (event) => {
  try {
    const pb = await getAuthenticatedPocketBase()
    const method = getMethod(event)

    if (method === 'POST') {
      const body = await readBody(event)
      const { userId, points, reason } = body

      if (!userId) {
        throw createError({
          statusCode: 400,
          message: 'User ID is required'
        })
      }

      if (!points || points <= 0) {
        throw createError({
          statusCode: 400,
          message: 'Valid points amount is required'
        })
      }

      // Get or create user_points record
      let userPointsRecord
      try {
        // Try to find existing record
        const records = await pb.collection('user_points').getList(1, 1, {
          filter: `user = "${userId}"`
        })

        if (records.items.length > 0) {
          userPointsRecord = records.items[0]
          // Update points
          const updated = await pb.collection('user_points').update(userPointsRecord.id, {
            points: userPointsRecord.points + points
          })
          return {
            success: true,
            points: updated.points,
            pointsAdded: points,
            reason
          }
        } else {
          // Create new record
          const created = await pb.collection('user_points').create({
            user: userId,
            points: points
          })
          return {
            success: true,
            points: created.points,
            pointsAdded: points,
            reason
          }
        }
      } catch (error: any) {
        console.error('Error awarding points:', error)
        throw createError({
          statusCode: 500,
          message: error.message || 'Failed to award points'
        })
      }
    }
  } catch (error: any) {
    console.error('Points API error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to process points request'
    })
  }
})

