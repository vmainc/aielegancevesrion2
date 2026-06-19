import { createError, getRouterParam, setHeader } from 'h3'
import { readConceptReferenceImage } from '~/server/utils/concept-reference-image-store'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing image id' })
  }

  const image = await readConceptReferenceImage(id)
  if (!image) {
    throw createError({ statusCode: 404, message: 'Reference image not found or expired' })
  }

  setHeader(event, 'Content-Type', image.mime)
  setHeader(event, 'Cache-Control', 'private, max-age=3600')
  return image.data
})
