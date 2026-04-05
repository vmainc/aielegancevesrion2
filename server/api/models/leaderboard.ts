import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'

export default defineEventHandler(async (event) => {
  try {
    const pb = await getAuthenticatedPocketBase()
    
    // Get all ratings from the ratings collection
    let allRatings = []
    try {
      allRatings = await pb.collection('ratings').getFullList({
        filter: 'rating > 0' // Only count actual ratings (not 0/unrated)
      })
    } catch (error) {
      // If ratings collection doesn't exist yet, return empty leaderboard
      console.warn('Ratings collection may not exist yet:', error)
      return []
    }

    // Initialize model stats
    const modelStats: Record<string, { totalScore: number; voteCount: number; averageRating: number }> = {}
    
    // Process all ratings to calculate model stats
    allRatings.forEach((rating: any) => {
      const modelName = rating.model
      const ratingValue = rating.rating

      if (ratingValue > 0) {
        if (!modelStats[modelName]) {
          modelStats[modelName] = {
            totalScore: 0,
            voteCount: 0,
            averageRating: 0
          }
        }
        
        modelStats[modelName].totalScore += ratingValue
        modelStats[modelName].voteCount += 1
      }
    })

    // Calculate averages and prepare leaderboard
    const leaderboard = Object.entries(modelStats)
      .map(([model, stats]) => ({
        model,
        totalScore: stats.totalScore,
        voteCount: stats.voteCount,
        averageRating: stats.voteCount > 0 ? stats.totalScore / stats.voteCount : 0
      }))
      .sort((a, b) => {
        // Sort by average rating, then by total score, then by vote count
        if (b.averageRating !== a.averageRating) {
          return b.averageRating - a.averageRating
        }
        if (b.totalScore !== a.totalScore) {
          return b.totalScore - a.totalScore
        }
        return b.voteCount - a.voteCount
      })

    return leaderboard
  } catch (error: any) {
    console.error('Error fetching model leaderboard:', error)
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to fetch model leaderboard'
    })
  }
})

