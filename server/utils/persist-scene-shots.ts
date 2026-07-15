import type PocketBase from 'pocketbase'
import type { GeneratedShot } from '~/server/utils/generate-shots-ai'
import { pbRecordToCreativeShot } from '~/server/utils/creative-shot-map'
import {
  formatPocketBaseRecordError,
  isPocketBaseMissingCollectionError
} from '~/server/utils/pb-missing-collection-error'

/** Same as `scripts/setup-collections.js` — PocketBase Admin API expects flat field props after merge. */
function flattenPb036Fields (fields: unknown[]): unknown[] {
  if (!fields || !Array.isArray(fields)) return fields as unknown[]
  return fields.map((f) => {
    if (!f || typeof f !== 'object' || (f as { options?: unknown }).options == null) return f
    const { options, ...rest } = f as { options: Record<string, unknown>; [k: string]: unknown }
    const opt = { ...options }
    if ((f as { type?: string }).type === 'select' && Array.isArray(opt.values)) {
      opt.values = (opt.values as unknown[]).map(v =>
        typeof v === 'object' && v !== null && 'value' in v ? (v as { value: string }).value : v
      )
    }
    const merged = { ...rest, ...opt }
    return Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined))
  })
}

async function getCollectionIdByName (pb: PocketBase, name: string): Promise<string> {
  const col = await pb.collections.getFirstListItem(`name="${name}"`)
  return String((col as { id: string }).id)
}

async function getUsersCollectionId (pb: PocketBase): Promise<string> {
  try {
    return await getCollectionIdByName(pb, 'users')
  } catch {
    return '_pb_users_auth_'
  }
}

async function ensureCreativeShotsCollection (pb: PocketBase): Promise<void> {
  try {
    await pb.collections.getFirstListItem('name="creative_shots"')
    return
  } catch (e: unknown) {
    if (!isPocketBaseMissingCollectionError(e)) throw e
  }

  const usersCollectionId = await getUsersCollectionId(pb)
  const creativeProjectsId = await getCollectionIdByName(pb, 'creative_projects')
  const creativeScenesId = await getCollectionIdByName(pb, 'creative_scenes')

  const fields = flattenPb036Fields([
    {
      name: 'owned_by',
      type: 'relation',
      required: true,
      options: {
        collectionId: usersCollectionId,
        cascadeDelete: false,
        minSelect: null,
        maxSelect: 1,
        displayFields: ['email']
      }
    },
    {
      name: 'project',
      type: 'relation',
      required: false,
      options: {
        collectionId: creativeProjectsId,
        cascadeDelete: true,
        minSelect: null,
        maxSelect: 1,
        displayFields: ['name']
      }
    },
    {
      name: 'scene',
      type: 'relation',
      required: true,
      options: {
        collectionId: creativeScenesId,
        cascadeDelete: true,
        minSelect: null,
        maxSelect: 1,
        displayFields: ['heading']
      }
    },
    {
      name: 'sort_order',
      type: 'number',
      required: true,
      options: { min: 0, onlyInt: true }
    },
    { name: 'title', type: 'text', required: true, options: { max: 500 } },
    { name: 'description', type: 'text', required: false, options: { max: 10000 } },
    { name: 'shot_type', type: 'text', required: false, options: { max: 300 } },
    { name: 'camera_move', type: 'text', required: false, options: { max: 300 } },
    { name: 'duration_seconds', type: 'number', required: false, options: { min: 0 } },
    { name: 'image_prompt', type: 'text', required: false, options: { max: 20000 } },
    { name: 'video_prompt', type: 'text', required: false, options: { max: 20000 } },
    { name: 'negative_prompt', type: 'text', required: false, options: { max: 10000 } }
  ])

  try {
    await pb.collections.create({
      name: 'creative_shots',
      type: 'base',
      listRule: '@request.auth.id != "" && owned_by = @request.auth.id',
      viewRule: '@request.auth.id != "" && owned_by = @request.auth.id',
      createRule: '@request.auth.id != "" && owned_by = @request.auth.id',
      updateRule: '@request.auth.id != "" && owned_by = @request.auth.id',
      deleteRule: '@request.auth.id != "" && owned_by = @request.auth.id',
      fields: fields as never[]
    })
  } catch (e: unknown) {
    const msg = formatPocketBaseRecordError(e).toLowerCase()
    if (!msg.includes('already exists') && !msg.includes('unique')) {
      throw e
    }
  }
}

export type ManualSceneShotInput = {
  title?: string
  description?: string
  shot_type?: string
  camera_move?: string
  duration_seconds?: number
  image_prompt?: string
  video_prompt?: string
  negative_prompt?: string
}

async function nextSceneShotSortOrder (pb: PocketBase, sceneId: string): Promise<number> {
  let rows: { sort_order?: unknown }[] = []
  try {
    rows = await pb.collection('creative_shots').getFullList({
      filter: `scene="${sceneId}"`,
      sort: '-sort_order',
      batch: 1
    })
  } catch (e: unknown) {
    if (!isPocketBaseMissingCollectionError(e)) throw e
    await ensureCreativeShotsCollection(pb)
    rows = await pb.collection('creative_shots').getFullList({
      filter: `scene="${sceneId}"`,
      sort: '-sort_order',
      batch: 1
    })
  }
  if (!rows.length) return 1
  const prev = Number(rows[0]!.sort_order)
  const base = Number.isFinite(prev) ? Math.max(0, Math.floor(prev)) : 0
  return base + 1
}

async function createOneCreativeShot (
  pb: PocketBase,
  userId: string,
  projectId: string,
  sceneId: string,
  sortOrderValue: number,
  g: GeneratedShot | ManualSceneShotInput
): Promise<ReturnType<typeof pbRecordToCreativeShot>> {
  const makeBasePayload = (includeNegative: boolean) => ({
    owned_by: userId,
    project: projectId,
    scene: sceneId,
    title: (g.title || 'Untitled board').slice(0, 500),
    description: (g.description || '').slice(0, 10000),
    shot_type: (g.shot_type || 'medium').slice(0, 300),
    camera_move: (g.camera_move || 'static').slice(0, 300),
    duration_seconds: Number.isFinite(Number(g.duration_seconds)) ? Number(g.duration_seconds) : 5,
    image_prompt: (g.image_prompt || '').slice(0, 20000),
    video_prompt: (g.video_prompt || '').slice(0, 20000),
    ...(includeNegative && g.negative_prompt?.trim()
      ? { negative_prompt: g.negative_prompt.trim().slice(0, 10000) }
      : {})
  })
  const createShot = async (includeNegative: boolean) =>
    pb.collection('creative_shots').create({
      ...makeBasePayload(includeNegative),
      sort_order: sortOrderValue
    })
  let rec: unknown
  try {
    rec = await createShot(true)
  } catch (e: unknown) {
    if (isPocketBaseMissingCollectionError(e)) {
      await ensureCreativeShotsCollection(pb)
      rec = await createShot(true)
    } else {
      const msg = formatPocketBaseRecordError(e)
      if (/negative_prompt/i.test(msg) && /unknown|invalid/i.test(msg)) {
        rec = await createShot(false)
      } else if (/sort_order: cannot be blank/i.test(msg)) {
        rec = await pb.collection('creative_shots').create({
          ...makeBasePayload(true),
          sortOrder: sortOrderValue
        })
      } else {
        throw new Error(
          msg
            ? `creative_shots create failed: ${msg}. Run setup-db/add-fields so local schema matches current app.`
            : 'creative_shots create failed. Run setup-db/add-fields so local schema matches current app.'
        )
      }
    }
  }
  return pbRecordToCreativeShot(rec as Parameters<typeof pbRecordToCreativeShot>[0])
}

/** Append a single blank or partially filled board to a scene. */
export async function createSceneShot (
  pb: PocketBase,
  userId: string,
  projectId: string,
  sceneId: string,
  input: ManualSceneShotInput = {}
): Promise<ReturnType<typeof pbRecordToCreativeShot>> {
  const sortOrderValue = await nextSceneShotSortOrder(pb, sceneId)
  const title = input.title?.trim() || `Board ${sortOrderValue}`
  return createOneCreativeShot(pb, userId, projectId, sceneId, sortOrderValue, {
    ...input,
    title
  })
}

/** Remove one board from a scene. */
export async function deleteSceneShot (
  pb: PocketBase,
  userId: string,
  projectId: string,
  sceneId: string,
  shotId: string
): Promise<void> {
  const existing = await pb.collection('creative_shots').getOne(shotId)
  const sp =
    typeof existing.project === 'string' ? existing.project : (existing.project as { id?: string })?.id
  const ss =
    typeof existing.scene === 'string' ? existing.scene : (existing.scene as { id?: string })?.id
  if (sp !== projectId || ss !== sceneId) {
    throw new Error('Shot does not match project/scene')
  }
  // Access is enforced by the caller (requireProjectOwner); owned_by may be the project owner, not the acting member.
  await pb.collection('creative_shots').delete(shotId)
}

/**
 * Replace all creative_shots for a scene with a new generated list (storyboard / shot list).
 */
export async function replaceSceneShots (
  pb: PocketBase,
  userId: string,
  projectId: string,
  sceneId: string,
  shots: GeneratedShot[]
): Promise<ReturnType<typeof pbRecordToCreativeShot>[]> {
  let existing: { id: string }[] = []
  try {
    existing = await pb.collection('creative_shots').getFullList({
      filter: `scene="${sceneId}"`,
      batch: 500
    })
  } catch (e: unknown) {
    if (!isPocketBaseMissingCollectionError(e)) {
      throw e
    }
    await ensureCreativeShotsCollection(pb)
    existing = await pb.collection('creative_shots').getFullList({
      filter: `scene="${sceneId}"`,
      batch: 500
    })
  }
  for (const row of existing) {
    await pb.collection('creative_shots').delete(row.id)
  }

  const created: ReturnType<typeof pbRecordToCreativeShot>[] = []
  for (let i = 0; i < shots.length; i++) {
    const g = shots[i]!
    const sortOrderValue = Math.max(1, Math.floor(Number(g.order || (i + 1))))
    created.push(
      await createOneCreativeShot(pb, userId, projectId, sceneId, sortOrderValue, g)
    )
  }
  created.sort((a, b) => a.sortOrder - b.sortOrder)
  return created
}
