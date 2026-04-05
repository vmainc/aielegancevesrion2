import { readMultipartFormData, createError } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { parseFdxXml } from '~/server/utils/parse-script-fdx'
import { parsePlainScriptText } from '~/server/utils/parse-script-txt'
import { extractTextFromPdfBuffer } from '~/server/utils/extract-pdf-text'
import { enrichScriptWithAi } from '~/server/utils/script-import-ai'
import { pbRecordToCreativeProject } from '~/server/utils/creative-project-map'

const ASPECT = new Set(['16:9', '9:16', '1:1'])
const GOALS = new Set(['film', 'social', 'commercial', 'other'])

export default defineEventHandler(async (event) => {
  const userId = await getPocketBaseUserIdFromRequest(event)

  const parts = await readMultipartFormData(event)
  if (!parts?.length) {
    throw createError({ statusCode: 400, message: 'No form data' })
  }

  let fileBuf: Buffer | null = null
  let filename = 'script'
  let projectName = ''
  let aspectRatio = '16:9'
  let goal = 'film'

  for (const part of parts) {
    if (!part.name) continue
    if (part.name === 'file' && part.data?.length && part.filename) {
      fileBuf = part.data
      filename = part.filename
    }
    if (part.name === 'name' && part.data) {
      projectName = part.data.toString('utf8').trim()
    }
    if (part.name === 'aspectRatio' && part.data) {
      const v = part.data.toString('utf8').trim()
      if (ASPECT.has(v)) aspectRatio = v
    }
    if (part.name === 'goal' && part.data) {
      const v = part.data.toString('utf8').trim()
      if (GOALS.has(v)) goal = v
    }
  }

  if (!fileBuf?.length) {
    throw createError({ statusCode: 400, message: 'Missing script file' })
  }

  const lower = filename.toLowerCase()
  const isFdx = lower.endsWith('.fdx')
  const isTxt = lower.endsWith('.txt')
  const isPdf = lower.endsWith('.pdf')
  if (!isFdx && !isTxt && !isPdf) {
    throw createError({ statusCode: 400, message: 'Only .fdx, .txt, and .pdf files are supported' })
  }

  let parsed
  try {
    if (isPdf) {
      const text = await extractTextFromPdfBuffer(fileBuf)
      parsed = parsePlainScriptText(text)
    } else {
      const xmlOrText = fileBuf.toString('utf8')
      parsed = isFdx ? parseFdxXml(xmlOrText) : parsePlainScriptText(xmlOrText)
    }
  } catch (e: any) {
    throw createError({
      statusCode: 400,
      message: e?.message || 'Could not parse script'
    })
  }

  if (!parsed.scenes.length) {
    throw createError({ statusCode: 400, message: 'No scenes found in file' })
  }

  const title =
    projectName ||
    filename.replace(/\.(fdx|txt|pdf)$/i, '').replace(/[_-]+/g, ' ').trim() ||
    'Imported project'

  const sceneOutline = parsed.scenes
    .map((s, i) => `## Scene ${i}\nHeading: ${s.heading}\n---\n${s.body.slice(0, 2500)}`)
    .join('\n\n')

  const enrichment = await enrichScriptWithAi({
    projectName: title,
    sceneOutline,
    characterNames: parsed.characterNames
  })

  const pb = await getAuthenticatedPocketBase()

  const project = await pb.collection('creative_projects').create({
    name: title,
    user: userId,
    aspect_ratio: aspectRatio,
    goal,
    synopsis: enrichment.summary,
    treatment: '',
    concept_notes: `Imported from ${filename}. Original scene count: ${parsed.scenes.length}.`,
    genre: enrichment.genre,
    tone: enrichment.tone,
    themes: enrichment.themes.length ? enrichment.themes : null,
    source_filename: filename
  })

  const projectId = project.id

  for (let i = 0; i < parsed.scenes.length; i++) {
    const s = parsed.scenes[i]
    const aiSum =
      enrichment.sceneSummaries.find(x => x.index === i)?.summary ||
      s.body.replace(/\s+/g, ' ').trim().slice(0, 280)
    await pb.collection('creative_scenes').create({
      project: projectId,
      user: userId,
      sort_order: i,
      heading: s.heading.slice(0, 500),
      summary: (aiSum || s.heading).slice(0, 2000),
      body: s.body.slice(0, 100000)
    })
  }

  const seenChar = new Set<string>()
  for (const c of enrichment.characterRoles) {
    const key = c.name.toLowerCase()
    if (seenChar.has(key)) continue
    seenChar.add(key)
    await pb.collection('creative_characters').create({
      project: projectId,
      user: userId,
      name: c.name.slice(0, 200),
      role_description: c.role_description.slice(0, 5000)
    })
  }

  const full = await pb.collection('creative_projects').getOne(projectId)

  return {
    project: pbRecordToCreativeProject(full as Parameters<typeof pbRecordToCreativeProject>[0])
  }
})
