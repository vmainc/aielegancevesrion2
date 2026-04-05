import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'

export default defineEventHandler(async (event) => {
  try {
    const pb = await getAuthenticatedPocketBase()
    const opts = { sort: '-points' as const, expand: 'user' as const }
    let records
    try {
      records = await pb.collection('user_points').getList(1, 100, opts)
    } catch (expandErr: any) {
      console.warn('leaderboard: expand=user failed, retrying without expand:', expandErr?.message)
      records = await pb.collection('user_points').getList(1, 100, {
        sort: '-points'
      })
    }
    return records
  } catch (error: any) {
    console.error('Error fetching leaderboard:', error)
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to fetch leaderboard'
    })
  }
})

