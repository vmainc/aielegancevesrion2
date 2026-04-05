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
      const { userId, comment } = body

      if (!userId) {
        throw createError({
          statusCode: 400,
          message: 'User ID is required'
        })
      }

      if (!comment || !comment.trim()) {
        throw createError({
          statusCode: 400,
          message: 'Comment text is required'
        })
      }

      // Create comment
      const newComment = await pb.collection('comments').create({
        question: questionId,
        user: userId,
        comment: comment.trim()
      })

      // Award 15 points for commenting
      try {
        let userPointsRecord
        try {
          const records = await pb.collection('user_points').getList(1, 1, {
            filter: `user = "${userId}"`
          })

          if (records.items.length > 0) {
            userPointsRecord = records.items[0]
            await pb.collection('user_points').update(userPointsRecord.id, {
              points: userPointsRecord.points + 15
            })
          } else {
            await pb.collection('user_points').create({
              user: userId,
              points: 15
            })
          }
        } catch (pointsError) {
          console.error('Failed to award points for comment:', pointsError)
        }
      } catch (pointsError) {
        console.error('Failed to award points for comment:', pointsError)
      }

      // Return comment with user expanded
      const commentWithUser = await pb.collection('comments').getOne(newComment.id, {
        expand: 'user'
      })

      return {
        success: true,
        comment: commentWithUser,
        pointsAwarded: 15
      }
    }

    if (method === 'GET') {
      // Get all comments for this question
      let comments
      try {
        comments = await pb.collection('comments').getList(1, 100, {
          filter: `question = "${questionId}"`,
          sort: '-created',
          expand: 'user'
        })
      } catch (expandErr: any) {
        console.warn('comments GET: expand=user failed, retrying:', expandErr?.message)
        comments = await pb.collection('comments').getList(1, 100, {
          filter: `question = "${questionId}"`,
          sort: '-created'
        })
      }

      return comments
    }
  } catch (error: any) {
    console.error('Comments API error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to process comment'
    })
  }
})

