#!/usr/bin/env node
/**
 * PASS 6 — Production Bible foundation slice verification.
 * Run: node scripts/verify-production-bible.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function read (rel) {
  return readFileSync(join(root, rel), 'utf8')
}

function exists (rel) {
  return existsSync(join(root, rel))
}

const checks = []

function assert (name, ok) {
  checks.push({ name, ok })
}

const entityType = read('types/bible-entity.ts')
assert('BibleEntity type defined', entityType.includes('export interface BibleEntity'))
assert('BibleEntity includes projectId', entityType.includes('projectId: string'))
assert('BibleEntity includes provenance fields', entityType.includes('sourceType') && entityType.includes('actorType'))
assert('entity type enum exported', entityType.includes('BIBLE_ENTITY_TYPES'))

const factType = read('types/bible-fact.ts')
assert('BibleFact type defined', factType.includes('export interface BibleFact'))
assert('BibleFact includes statement', factType.includes('statement: string'))

const relType = read('types/bible-relationship.ts')
assert('BibleRelationship type defined', relType.includes('export interface BibleRelationship'))
assert('endpoint types exported', relType.includes('BIBLE_ENDPOINT_TYPES'))

const entityMap = read('server/utils/bible-entity-map.ts')
assert('entity mapper exports pbRecordToBibleEntity', entityMap.includes('export function pbRecordToBibleEntity'))
assert('entity mapper exports projectIdOnBibleEntityRow', entityMap.includes('export function projectIdOnBibleEntityRow'))

const factMap = read('server/utils/bible-fact-map.ts')
assert('fact mapper exports pbRecordToBibleFact', factMap.includes('export function pbRecordToBibleFact'))
assert('fact mapper exports projectIdOnBibleFactRow', factMap.includes('export function projectIdOnBibleFactRow'))

const relMap = read('server/utils/bible-relationship-map.ts')
assert('relationship mapper exports pbRecordToBibleRelationship', relMap.includes('export function pbRecordToBibleRelationship'))

const access = read('server/utils/bible-project-access.ts')
assert('shared project access helper', access.includes('export async function requireProjectOwner'))
assert('shared owned row helper', access.includes('export async function requireOwnedProjectRow'))

const validation = read('server/utils/bible-validation.ts')
assert('entity type validation', validation.includes('export function parseBibleEntityType'))
assert('name validation', validation.includes('export function parseBibleName'))
assert('fact statement validation', validation.includes('export function parseBibleFactStatement'))
assert('endpoint validation', validation.includes('export function parseBibleEndpointType'))
assert('projectId consistency check', validation.includes('export function parseOptionalProjectId'))

const entityRoutes = [
  'server/api/projects/[id]/bible/entities.get.ts',
  'server/api/projects/[id]/bible/entities.post.ts',
  'server/api/projects/[id]/bible/entities/[entityId].get.ts',
  'server/api/projects/[id]/bible/entities/[entityId].patch.ts',
  'server/api/projects/[id]/bible/entities/[entityId].delete.ts'
]

for (const file of entityRoutes) {
  assert(`${file} exists`, exists(file))
  const src = read(file)
  assert(`${file} requires project owner`, src.includes('requireProjectOwner'))
  assert(`${file} uses bible entity mapper`, src.includes('bible-entity-map'))
}

const factRoutes = [
  'server/api/projects/[id]/bible/facts.get.ts',
  'server/api/projects/[id]/bible/facts.post.ts',
  'server/api/projects/[id]/bible/facts/[factId].get.ts',
  'server/api/projects/[id]/bible/facts/[factId].patch.ts',
  'server/api/projects/[id]/bible/facts/[factId].delete.ts'
]

for (const file of factRoutes) {
  assert(`${file} exists`, exists(file))
  const src = read(file)
  assert(`${file} requires project owner`, src.includes('requireProjectOwner'))
  assert(`${file} uses bible fact mapper`, src.includes('bible-fact-map'))
}

const relationshipRoutes = [
  'server/api/projects/[id]/bible/relationships.get.ts',
  'server/api/projects/[id]/bible/relationships.post.ts',
  'server/api/projects/[id]/bible/relationships/[relationshipId].get.ts',
  'server/api/projects/[id]/bible/relationships/[relationshipId].patch.ts',
  'server/api/projects/[id]/bible/relationships/[relationshipId].delete.ts'
]

for (const file of relationshipRoutes) {
  assert(`${file} exists`, exists(file))
  const src = read(file)
  assert(`${file} requires project owner`, src.includes('requireProjectOwner'))
  assert(`${file} uses bible relationship mapper`, src.includes('bible-relationship-map'))
}

assert('relationship create validates endpoints', read('server/api/projects/[id]/bible/relationships.post.ts').includes('assertBibleEndpointInProject'))
assert('fact create validates entity project', read('server/api/projects/[id]/bible/facts.post.ts').includes('requireOwnedProjectRow'))

const setup = read('scripts/setup-collections.js')
assert('setup script provisions bible_entities', setup.includes("name: 'bible_entities'"))
assert('setup script provisions bible_facts', setup.includes("name: 'bible_facts'"))
assert('setup script provisions bible_relationships', setup.includes("name: 'bible_relationships'"))

const doc = read('docs/ProductionBibleDesign.md')
assert('design doc has PASS 6 note', doc.includes('PASS 6'))
assert('design doc has PASS 7 note', doc.includes('PASS 7'))
assert('design doc has PASS 8 note', doc.includes('PASS 8'))

assert('bible page exists', exists('pages/projects/[projectId]/bible.vue'))
assert('production bible panel exists', exists('components/project/ProductionBiblePanel.vue'))
assert('production bible composable exists', exists('composables/useProductionBible.ts'))

const panel = read('components/project/ProductionBiblePanel.vue')
assert('panel uses production bible composable', panel.includes('useProductionBible'))
assert('panel has no entities empty state', panel.includes('No entities yet'))
assert('panel has no facts empty state', panel.includes('No facts yet'))
assert('panel has no relationships empty state', panel.includes('No relationships yet'))

const layout = read('components/project/ProjectWorkspaceLayout.vue')
assert('workspace nav includes bible tab', layout.includes("path: 'bible'"))

const composable = read('composables/useProductionBible.ts')
assert('composable wraps entity CRUD', composable.includes('loadEntities') && composable.includes('deleteEntity'))
assert('composable wraps fact CRUD', composable.includes('loadFacts') && composable.includes('deleteFact'))
assert('composable wraps relationship CRUD', composable.includes('loadRelationships') && composable.includes('deleteRelationship'))
assert('composable wraps seed', composable.includes('seedFromProject'))

assert('seed route exists', exists('server/api/projects/[id]/bible/seed.post.ts'))
assert('seed util exists', exists('server/utils/seed-production-bible.ts'))
const seedRoute = read('server/api/projects/[id]/bible/seed.post.ts')
assert('seed route requires project owner', seedRoute.includes('requireProjectOwner'))
assert('seed route calls seed util', seedRoute.includes('seedProductionBibleFromProject'))

const seedUtil = read('server/utils/seed-production-bible.ts')
assert('seed creates character entities', seedUtil.includes("type: 'character'"))
assert('seed creates location entities', seedUtil.includes("type: 'location'"))
assert('seed creates appears_in relationships', seedUtil.includes("'appears_in'"))
assert('seed creates belongs_to shot relationships', seedUtil.includes("'belongs_to'"))
assert('seed dedupes entities by key', seedUtil.includes('bibleEntityDedupeKey'))

const locLib = read('lib/bible-scene-location.ts')
assert('location extract handles INT slug', locLib.includes('INT'))

const panelSeed = read('components/project/ProductionBiblePanel.vue')
assert('panel has seed button', panelSeed.includes('Seed from Project'))
assert('panel shows seed summary modal', panelSeed.includes('seedModalOpen'))

assert('PASS 9 context resolver exists', exists('server/utils/resolve-production-bible-context.ts'))
assert('PASS 9 context API exists', exists('server/api/projects/[id]/bible/context.get.ts'))
const resolver = read('server/utils/resolve-production-bible-context.ts')
assert('resolver exports resolveProductionBibleContext', resolver.includes('export async function resolveProductionBibleContext'))
assert('resolver supports scene and shot options', resolver.includes('sceneId') && resolver.includes('shotId'))
assert('resolver supports budgets', resolver.includes('maxItems') && resolver.includes('tokenBudget'))

const promptBlock = read('lib/format-production-bible-prompt-block.ts')
assert('prompt block formatter exists', promptBlock.includes('formatProductionBiblePromptBlock'))

const unified = read('lib/unified-shot-prompt.ts')
assert('unified prompt accepts productionBible', unified.includes('productionBible'))
assert('unified prompt appends bible block', unified.includes('formatProductionBiblePromptBlock'))

const prefill = read('server/utils/project-video-panel-prefill.ts')
assert('video panel prefill resolves bible context', prefill.includes('resolveProductionBibleForGeneration'))
assert('video panel prefill passes productionBible', prefill.includes('productionBible'))
assert('video prefill bible context fails open', prefill.includes('resolveProductionBibleForGeneration'))

assert('design doc has PASS 9 note', doc.includes('PASS 9'))
assert('design doc has PASS 10 note', doc.includes('PASS 10'))

assert('PASS 11 continuity bible helper exists', exists('lib/continuity-bible-fact.ts'))
const continuityBible = read('lib/continuity-bible-fact.ts')
assert('continuity bible fact type constant', continuityBible.includes("CONTINUITY_BIBLE_FACT_TYPE = 'continuity'"))
assert('continuity bible source type constant', continuityBible.includes("CONTINUITY_BIBLE_SOURCE_TYPE = 'continuity_check'"))
assert('continuity dedupe key helper', continuityBible.includes('export function continuityBibleFactDedupeKey'))
assert('continuity entity resolution helper', continuityBible.includes('export function resolveContinuityFactEntityId'))

assert('PASS 11 persist continuity bible facts util exists', exists('server/utils/persist-continuity-bible-facts.ts'))
const persistBible = read('server/utils/persist-continuity-bible-facts.ts')
assert('persist exports persistContinuityFindingsToBible', persistBible.includes('export async function persistContinuityFindingsToBible'))
assert('persist never updates existing facts', !persistBible.includes('.update('))
assert('persist uses draft or needs_review status', persistBible.includes('continuityFactStatusForIssue'))

const executeShots = read('server/utils/execute-generate-shots.ts')
assert('generate shots wires continuity bible write-back', executeShots.includes('persistContinuityFindingsToBible'))

assert('bible fact types include continuity', factType.includes("'continuity'"))
assert('bible fact statuses include draft', factType.includes("'draft'"))
assert('bible fact statuses include needs_review', factType.includes("'needs_review'"))
assert('setup includes draft status on bible_facts', setup.includes("{ value: 'draft' }"))
assert('setup includes needs_review status on bible_facts', setup.includes("{ value: 'needs_review' }"))

assert('panel shows continuity findings section', panel.includes('Facts pending review'))
assert('panel loads project-wide facts', panel.includes('projectFacts'))

assert('design doc has PASS 11 note', doc.includes('PASS 11'))

assert('PASS 12 review helper exists', exists('lib/bible-trust.ts'))
const reviewLib = read('lib/bible-trust.ts')
assert('review lib defines trusted context check', reviewLib.includes('export function isBibleFactTrustedForContext'))
assert('review lib defines pending review check', reviewLib.includes('export function isBibleFactPendingReview'))
assert('review lib defines status display labels', reviewLib.includes('export function bibleStatusDisplayLabel'))
assert('fact review re-exports trust helpers', read('lib/bible-fact-review.ts').includes('~/lib/bible-trust'))

const resolverPass12 = read('server/utils/resolve-production-bible-context.ts')
assert('resolver excludes pending review facts by default', resolverPass12.includes('isBibleFactTrustedForContext'))
assert('resolver supports includeReviewFacts', resolverPass12.includes('includeReviewFacts'))
assert('resolver tracks excluded review facts', resolverPass12.includes('reviewFactsExcluded'))

const contextApi = read('server/api/projects/[id]/bible/context.get.ts')
assert('context API supports debugReview query', contextApi.includes('debugReview'))

const composablePass12 = read('composables/useProductionBible.ts')
assert('composable exposes approveFact', composablePass12.includes('approveFact'))
assert('composable exposes rejectFact', composablePass12.includes('rejectFact'))

const panelPass12 = read('components/project/ProductionBiblePanel.vue')
assert('panel has approve fact action', panelPass12.includes('onApproveFact'))
assert('panel has reject fact action', panelPass12.includes('onRejectFact'))
assert('panel has save and approve action', panelPass12.includes('onSaveAndApproveFact'))
assert('panel uses status badge classes', panelPass12.includes('factStatusClass') || panelPass12.includes('statusClass'))

const factsPost = read('server/api/projects/[id]/bible/facts.post.ts')
assert('user-authored facts default actor user', factsPost.includes("payload.actor_type = 'user'"))

assert('design doc has PASS 12 note', doc.includes('PASS 12'))

const seedNormalize = read('lib/bible-seed-normalize.ts')
assert('seed entity status constant tentative', seedNormalize.includes("BIBLE_SEED_ENTITY_STATUS = 'tentative'"))
assert('seed fact status constant needs_review', seedNormalize.includes("BIBLE_SEED_FACT_STATUS = 'needs_review'"))
assert('seed relationship status constant tentative', seedNormalize.includes("BIBLE_SEED_RELATIONSHIP_STATUS = 'tentative'"))

assert('seed util creates facts as needs_review', seedUtil.includes('BIBLE_SEED_FACT_STATUS'))
assert('seed util creates entities as tentative', seedUtil.includes('BIBLE_SEED_ENTITY_STATUS'))
assert('seed util creates relationships as tentative', seedUtil.includes('BIBLE_SEED_RELATIONSHIP_STATUS'))
assert('seed util does not mark seeded rows active', !seedUtil.includes("status: 'active'"))

const panelPass13 = read('components/project/ProductionBiblePanel.vue')
assert('seed modal shows needs review facts', panelPass13.includes('Facts created (needs review)'))
assert('seed modal shows tentative entities', panelPass13.includes('Entities created (tentative)'))
assert('seed modal lists fact statuses', panelPass13.includes('New facts (needs review)'))
assert('panel unified pending review queue', panelPass13.includes('factsPendingReview'))

assert('design doc has PASS 13 note', doc.includes('PASS 13'))

assert('PASS 14 bible trust helper exists', exists('lib/bible-trust.ts'))
const trustLib = read('lib/bible-trust.ts')
assert('trust lib entity context check', trustLib.includes('export function isBibleEntityTrustedForContext'))
assert('trust lib relationship context check', trustLib.includes('export function isBibleRelationshipTrustedForContext'))
assert('trust lib tentative prompt label', trustLib.includes('BIBLE_TENTATIVE_PROMPT_LABEL'))

const resolverPass14 = read('server/utils/resolve-production-bible-context.ts')
assert('resolver uses entity trust helper', resolverPass14.includes('isBibleEntityTrustedForContext'))
assert('resolver uses relationship trust helper', resolverPass14.includes('isBibleRelationshipTrustedForContext'))
assert('resolver includes entity status in context', resolverPass14.includes('status: e.status'))
assert('resolver includes relationship status in context', resolverPass14.includes('status: r.status'))
assert('resolver re-checks fact trust when picking', resolverPass14.includes('!isBibleFactTrustedForContext(f, { includeReviewFacts })'))

const promptBlockPass14 = read('lib/format-production-bible-prompt-block.ts')
assert('prompt block labels tentative entities', promptBlockPass14.includes('BIBLE_TENTATIVE_PROMPT_LABEL'))
assert('prompt block provisional header when tentative', promptBlockPass14.includes('tentative items are provisional'))

assert('entity types include tentative status', entityType.includes("'tentative'"))

const panelPass14 = read('components/project/ProductionBiblePanel.vue')
assert('panel entity approve control', panelPass14.includes('onApproveEntity'))
assert('panel relationship approve control', panelPass14.includes('onApproveRel'))
assert('panel uses shared status badges', panelPass14.includes('statusClass'))

const composablePass14 = read('composables/useProductionBible.ts')
assert('composable exposes approveEntity', composablePass14.includes('approveEntity'))
assert('composable exposes retireRelationship', composablePass14.includes('retireRelationship'))

const bibleRoutes = [
  'server/api/projects/[id]/bible/entities.get.ts',
  'server/api/projects/[id]/bible/entities.post.ts',
  'server/api/projects/[id]/bible/entities/[entityId].get.ts',
  'server/api/projects/[id]/bible/entities/[entityId].patch.ts',
  'server/api/projects/[id]/bible/entities/[entityId].delete.ts',
  'server/api/projects/[id]/bible/facts.get.ts',
  'server/api/projects/[id]/bible/facts.post.ts',
  'server/api/projects/[id]/bible/facts/[factId].get.ts',
  'server/api/projects/[id]/bible/facts/[factId].patch.ts',
  'server/api/projects/[id]/bible/facts/[factId].delete.ts',
  'server/api/projects/[id]/bible/relationships.get.ts',
  'server/api/projects/[id]/bible/relationships.post.ts',
  'server/api/projects/[id]/bible/relationships/[relationshipId].get.ts',
  'server/api/projects/[id]/bible/relationships/[relationshipId].patch.ts',
  'server/api/projects/[id]/bible/relationships/[relationshipId].delete.ts',
  'server/api/projects/[id]/bible/context.get.ts',
  'server/api/projects/[id]/bible/seed.post.ts',
  'server/api/projects/[id]/bible/remediate-seeded-facts.post.ts',
  'server/api/projects/[id]/bible/link-cast.post.ts'
]
for (const route of bibleRoutes) {
  assert(`${route} secured by project owner`, read(route).includes('requireProjectOwner'))
}

const composableFailOpen = read('composables/useProductionBible.ts')
assert('composable loadContextForPrompt fails open', composableFailOpen.includes('catch') && composableFailOpen.includes('return null'))

assert('trust matrix script exists', exists('scripts/verify-bible-trust-matrix.mjs'))

assert('design doc has PASS 15 note', doc.includes('PASS 15'))

assert('PASS 16 legacy match helper exists', exists('lib/legacy-seeded-fact-match.ts'))
const legacyMatch = read('lib/legacy-seeded-fact-match.ts')
assert('legacy match checks project_seed source', legacyMatch.includes('BIBLE_SEED_SOURCE_TYPE'))
assert('legacy match excludes continuity facts', legacyMatch.includes('CONTINUITY_BIBLE_FACT_TYPE'))
assert('legacy match excludes user actor', legacyMatch.includes("actorType === 'user'"))
assert('legacy match target status needs_review', legacyMatch.includes("LEGACY_SEED_REMEDIATION_TARGET_STATUS = 'needs_review'"))

assert('PASS 16 remediate util exists', exists('server/utils/remediate-legacy-seeded-facts.ts'))
const remediateUtil = read('server/utils/remediate-legacy-seeded-facts.ts')
assert('remediate util supports dry run', remediateUtil.includes('dryRun'))
assert('remediate util only updates status', remediateUtil.includes('status: LEGACY_SEED_REMEDIATION_TARGET_STATUS'))

assert('PASS 16 remediate route exists', exists('server/api/projects/[id]/bible/remediate-seeded-facts.post.ts'))
const remediateRoute = read('server/api/projects/[id]/bible/remediate-seeded-facts.post.ts')
assert('remediate route requires project owner', remediateRoute.includes('requireProjectOwner'))
assert('remediate route defaults to dry run', remediateRoute.includes('dryRun !== false'))

const panelPass16 = read('components/project/ProductionBiblePanel.vue')
assert('panel legacy remediation button', panelPass16.includes('Review legacy seeded facts'))
assert('panel legacy remediation confirmation', panelPass16.includes('do not affect prompts until approved'))
assert('composable exposes remediateLegacySeededFacts', composable.includes('remediateLegacySeededFacts'))

assert('design doc has PASS 16 note', doc.includes('PASS 16'))

assert('PASS 17 cast bridge helper exists', exists('lib/bible-cast-bridge.ts'))
const castBridge = read('lib/bible-cast-bridge.ts')
assert('cast bridge builds maps', castBridge.includes('buildCastBibleBridgeMaps'))
assert('cast bridge explicit confidence', castBridge.includes("'explicit'"))
assert('cast bridge represents relationship', castBridge.includes('BIBLE_CAST_REPRESENTS_RELATIONSHIP'))
assert('cast bridge safe attach guard', castBridge.includes('canSafelyAttachCastMetadata'))

assert('PASS 17 link cast util exists', exists('server/utils/link-cast-to-bible.ts'))
const linkCastUtil = read('server/utils/link-cast-to-bible.ts')
assert('link cast util supports dry run', linkCastUtil.includes('dryRun'))
assert('link cast util skips user entities', linkCastUtil.includes('user-authored bible entity'))
assert('link cast util creates tentative entities', linkCastUtil.includes('BIBLE_SEED_ENTITY_STATUS'))

assert('PASS 17 link cast route exists', exists('server/api/projects/[id]/bible/link-cast.post.ts'))
const linkCastRoute = read('server/api/projects/[id]/bible/link-cast.post.ts')
assert('link cast route requires project owner', linkCastRoute.includes('requireProjectOwner'))
assert('link cast route defaults to dry run', linkCastRoute.includes('dryRun !== false'))

const resolverPass17 = read('server/utils/resolve-production-bible-context.ts')
assert('resolver uses cast bridge maps', resolverPass17.includes('buildCastBibleBridgeMaps'))
assert('resolver prefers bridge confidence', resolverPass17.includes('castBibleConfidencePriority'))

const endpointTypes = read('types/bible-relationship.ts')
assert('creative_character endpoint type', endpointTypes.includes("'creative_character'"))

const endpointAccess = read('server/utils/bible-endpoint-access.ts')
assert('endpoint access validates creative_character', endpointAccess.includes("endpointType === 'creative_character'"))

const panelPass17 = read('components/project/ProductionBiblePanel.vue')
assert('panel link cast button', panelPass17.includes('Link Cast to Bible'))
assert('panel linked cast visibility', panelPass17.includes('Linked cast record'))
assert('panel cast link confidence', panelPass17.includes('castBibleConfidenceLabel'))
assert('composable exposes linkCastToBible', composable.includes('linkCastToBible'))

assert('design doc has PASS 17 note', doc.includes('PASS 17'))

assert('PASS 18 generation context helper exists', exists('lib/production-bible-generation-context.ts'))
const genCtx = read('lib/production-bible-generation-context.ts')
assert('generation context appends bible block', genCtx.includes('appendProductionBibleToPrompt'))
assert('generation context builds debug metadata', genCtx.includes('buildProductionBibleGenerationDebug'))

assert('PASS 18 fail-open resolver exists', exists('server/utils/resolve-production-bible-for-generation.ts'))
const genResolver = read('server/utils/resolve-production-bible-for-generation.ts')
assert('generation resolver fail open', genResolver.includes('failOpenReason'))

const generateCharacter = read('server/api/generate-character.post.ts')
assert('generate-character supports projectId', generateCharacter.includes('projectId'))
assert('generate-character uses bible generation resolver', generateCharacter.includes('resolveProductionBibleForGeneration'))
assert('generate-character requires project owner when scoped', generateCharacter.includes('requireProjectOwner'))

const characterCreator = read('pages/character-creator.vue')
assert('character creator appends bible context', characterCreator.includes('appendProductionBibleToPrompt'))
assert('character creator uses cast character id', characterCreator.includes('contextCharacterId'))

const startFramePicker = read('components/video/VideoStartFramePicker.vue')
assert('start frame picker bible project prop', startFramePicker.includes('bibleProjectId'))
assert('start frame picker appends bible', startFramePicker.includes('appendProductionBibleToPrompt'))

const videoTool = read('pages/tools/video-generation.vue')
assert('video tool passes bible props to start frame picker', videoTool.includes('bible-project-id'))

assert('prefill includes characterIds for bible', read('lib/video-generation-prefill.ts').includes('characterIds'))
assert('panel prefill passes characterIds', read('server/utils/project-video-panel-prefill.ts').includes('characterIds: cast.map'))

assert('design doc has PASS 18 note', doc.includes('PASS 18'))

assert('PASS 19 generation defaults exist', genCtx.includes('DEFAULT_PRODUCTION_BIBLE_GENERATION_OPTIONS'))
assert('PASS 19 canonical debug label', genCtx.includes('productionBibleGenerationDebugLabel'))
assert('PASS 19 merge generation options', genCtx.includes('mergeProductionBibleGenerationOptions'))

const storyboardPass19 = read('pages/projects/[projectId]/storyboard.vue')
assert('storyboard uses canonical bible debug label', storyboardPass19.includes('productionBibleGenerationDebugLabel'))
assert('storyboard uses generation options merge', storyboardPass19.includes('mergeProductionBibleGenerationOptions'))
assert('storyboard runtime bible only in resolveFrameGenerationPrompt', storyboardPass19.includes('productionBible: productionBibleCtx'))
assert('storyboard does not patch imagePrompt with bible', !storyboardPass19.includes('imagePrompt: prompt'))

const videoPrefillPass19 = read('server/utils/project-video-panel-prefill.ts')
assert('video prefill uses fail-open generation resolver', videoPrefillPass19.includes('resolveProductionBibleForGeneration'))
assert('video prefill uses generation options merge', videoPrefillPass19.includes('mergeProductionBibleGenerationOptions'))

const videoToolPass19 = read('pages/tools/video-generation.vue')
assert('video tool uses canonical bible debug label', videoToolPass19.includes('productionBibleGenerationDebugLabel'))

const unifiedPrompt = read('lib/unified-shot-prompt.ts')
assert('unified prompt appends bible via formatProductionBiblePromptBlock', unifiedPrompt.includes('formatProductionBiblePromptBlock(ctx.productionBible)'))

assert('prompt block labels tentative rows', read('lib/format-production-bible-prompt-block.ts').includes('BIBLE_TENTATIVE_PROMPT_LABEL'))

assert('design doc has PASS 19 note', doc.includes('PASS 19'))

assert('PASS 20 pending fact filters exist', exists('lib/bible-pending-fact-filters.ts'))
const pendingFilters = read('lib/bible-pending-fact-filters.ts')
assert('pending filters source category', pendingFilters.includes('biblePendingFactSourceCategory'))
assert('pending filters scope filter', pendingFilters.includes("scope === 'entity'"))
assert('pending filters search', pendingFilters.includes('filters.search'))

const composablePass20 = read('composables/useProductionBible.ts')
assert('composable exposes approveFacts', composablePass20.includes('approveFacts'))
assert('composable exposes rejectFacts', composablePass20.includes('rejectFacts'))
assert('bulk approve uses approveFact', composablePass20.includes('await approveFact(id)'))

const panelPass20 = read('components/project/ProductionBiblePanel.vue')
assert('panel bulk approve selected', panelPass20.includes('onBulkApproveSelected'))
assert('panel bulk reject all visible', panelPass20.includes('onBulkRejectAllVisible'))
assert('panel pending fact checkboxes', panelPass20.includes('togglePendingFactSelection'))
assert('panel pending source filter', panelPass20.includes('pendingFactFilters.source'))
assert('panel bulk confirmation', panelPass20.includes('confirmBulkFactAction'))
assert('panel uses visible pending facts', panelPass20.includes('visiblePendingFacts'))

assert('design doc has PASS 20 note', doc.includes('PASS 20'))

const assetBridge = read('lib/bible-cast-asset-bridge.ts')
assert('PASS 21 asset bridge helper exists', exists('lib/bible-cast-asset-bridge.ts'))
assert('asset bridge reads bible_entity_id metadata', assetBridge.includes("bible_entity_id"))
assert('asset bridge resolves asset to cast', assetBridge.includes('resolveAssetToCastCharacter'))
assert('asset bridge resolves asset to bible entity', assetBridge.includes('resolveAssetToBibleEntity'))
assert('asset bridge resolves entity related assets', assetBridge.includes('resolveBibleEntityRelatedAssets'))
assert('asset bridge link source labels', assetBridge.includes('assetBibleLinkSourceLabel'))
assert('asset bridge counts cast assets', assetBridge.includes('countAssetsForCastCharacter'))
assert('asset bridge manual link candidates', assetBridge.includes('assetsLinkableToBibleEntity'))

const composablePass21 = read('composables/useProductionBible.ts')
assert('composable loads project assets', composablePass21.includes('loadProjectAssets'))
assert('composable patches project asset metadata', composablePass21.includes('patchProjectAsset'))

const panelPass21 = read('components/project/ProductionBiblePanel.vue')
assert('panel shows related assets section', panelPass21.includes('Related assets'))
assert('panel uses entity related assets resolver', panelPass21.includes('resolveBibleEntityRelatedAssets'))
assert('panel manual link asset action', panelPass21.includes('onLinkAssetToBibleEntity'))
assert('panel loads project assets', panelPass21.includes('loadProjectAssets'))

const castProfilePass21 = read('pages/projects/[projectId]/cast/[characterId].vue')
assert('cast profile shows bible entity link', castProfilePass21.includes('linkedBibleEntity'))
assert('cast profile shows asset count', castProfilePass21.includes('castAssetCount'))
assert('cast profile uses countAssetsForCastCharacter', castProfilePass21.includes('countAssetsForCastCharacter'))

assert('design doc has PASS 21 note', doc.includes('PASS 21'))

const genObs = read('lib/generation-observability.ts')
assert('PASS 22 generation observability helper exists', exists('lib/generation-observability.ts'))
assert('observability metadata key', genObs.includes('generation_observability'))
assert('observability record type', genObs.includes('GenerationObservabilityRecord'))
assert('observability build helper', genObs.includes('buildGenerationObservability'))
assert('observability read helper', genObs.includes('readGenerationObservability'))
assert('observability prompt hash only', genObs.includes('hashPromptForObservability'))
assert('observability bible entity ids', genObs.includes('bibleEntityIds'))
assert('observability merge into metadata', genObs.includes('mergeGenerationObservabilityIntoMetadata'))

const storyboardPass22 = read('pages/projects/[projectId]/storyboard.vue')
assert('storyboard stamps generation observability', storyboardPass22.includes('buildGenerationObservability'))
assert('storyboard merges observability metadata', storyboardPass22.includes('mergeGenerationObservabilityIntoMetadata'))

const charCreatorPass22 = read('pages/character-creator.vue')
assert('character creator stamps generation observability', charCreatorPass22.includes('buildGenerationObservability'))

const videoToolPass22 = read('pages/tools/video-generation.vue')
assert('video tool stamps generation observability', videoToolPass22.includes('buildGenerationObservability'))

const panelPass22 = read('components/project/ProductionBiblePanel.vue')
assert('panel shows generation observability', panelPass22.includes('formatAssetProvenanceLine'))
assert('panel does not surface prompt_used', !panelPass22.includes('prompt_used'))

assert('design doc has PASS 22 note', doc.includes('PASS 22'))

assert('PASS 23 forbidden observability keys', genObs.includes('GENERATION_OBSERVABILITY_FORBIDDEN_KEYS'))
assert('PASS 23 sanitize observability record', genObs.includes('sanitizeGenerationObservabilityRecord'))
assert('PASS 23 rejects forbidden prompt fields on read', genObs.includes('observabilityRecordHasForbiddenPromptFields'))
assert('PASS 23 prompt hash pattern guard', genObs.includes('PROMPT_HASH_PATTERN'))
assert('PASS 23 build hashes prompt only', genObs.includes('hashPromptForObservability(input.promptForHash)'))
assert('PASS 23 build does not persist prompt text', !genObs.includes('prompt: input.promptForHash'))
assert('PASS 23 merge preserves metadata spread', genObs.includes('...metadata'))
assert('PASS 23 canonical generation paths', genObs.includes('GENERATION_PATH'))
assert('PASS 23 standardized path labels', genObs.includes('GENERATION_PATH_LABELS'))
assert('PASS 23 legacy provenance line without prompt leak', genObs.includes('Legacy generated asset (no observability stamp)'))
assert('storyboard uses GENERATION_PATH constant', storyboardPass22.includes('GENERATION_PATH.STORYBOARD_FRAME'))
assert('character creator uses GENERATION_PATH constant', charCreatorPass22.includes('GENERATION_PATH.CHARACTER_CREATOR'))
assert('video tool uses GENERATION_PATH constants', videoToolPass22.includes('GENERATION_PATH.VIDEO_GENERATION'))

assert('design doc has PASS 23 note', doc.includes('PASS 23'))

const legacyPromptMeta = read('lib/legacy-asset-prompt-metadata.ts')
assert('PASS 24 legacy prompt metadata lib exists', exists('lib/legacy-asset-prompt-metadata.ts'))
assert('PASS 24 scans prompt_used', legacyPromptMeta.includes('prompt_used'))
assert('PASS 24 scans negative_prompt', legacyPromptMeta.includes('negative_prompt'))
assert('PASS 24 redacted marker', legacyPromptMeta.includes('[redacted]'))
assert('PASS 24 preserves observability key in redact', legacyPromptMeta.includes('GENERATION_OBSERVABILITY_METADATA_KEY'))
assert('PASS 24 stores hash not full prompt', legacyPromptMeta.includes('hashPromptForObservability'))

const redactUtil = read('server/utils/redact-legacy-asset-prompts.ts')
assert('PASS 24 redact util exists', exists('server/utils/redact-legacy-asset-prompts.ts'))
assert('PASS 24 redact verifies remaining leaks', redactUtil.includes('remainingLeakCount'))
assert('PASS 24 redact observability preserved', redactUtil.includes('observabilityPreservedCount'))

const redactRoute = read('server/api/projects/[id]/assets/redact-legacy-prompts.post.ts')
assert('PASS 24 redact route exists', exists('server/api/projects/[id]/assets/redact-legacy-prompts.post.ts'))
assert('PASS 24 redact route requires owner', redactRoute.includes('requireProjectOwner'))
assert('PASS 24 redact dry run default', redactRoute.includes('dryRun !== false'))

const composablePass24 = read('composables/useProductionBible.ts')
assert('composable exposes redactLegacyAssetPrompts', composablePass24.includes('redactLegacyAssetPrompts'))

const panelPass24 = read('components/project/ProductionBiblePanel.vue')
assert('panel legacy prompt redaction button', panelPass24.includes('Redact legacy prompt metadata'))
assert('panel legacy prompt confirmation', panelPass24.includes('keeps only hashes/markers'))
assert('panel preview legacy prompt redaction', panelPass24.includes('previewLegacyPromptRedaction'))

assert('design doc has PASS 24 note', doc.includes('PASS 24'))

const tentativeFilters = read('lib/bible-tentative-item-filters.ts')
assert('PASS 25 tentative item filters exist', exists('lib/bible-tentative-item-filters.ts'))
assert('PASS 25 builds tentative review items', tentativeFilters.includes('buildTentativeReviewItems'))
assert('PASS 25 filters tentative items', tentativeFilters.includes('filterTentativeReviewItems'))
assert('PASS 25 kind filter', tentativeFilters.includes("kind === 'entity'"))

const composablePass25 = read('composables/useProductionBible.ts')
assert('composable exposes approveEntities', composablePass25.includes('approveEntities'))
assert('composable exposes retireEntities', composablePass25.includes('retireEntities'))
assert('composable exposes approveRelationships bulk', composablePass25.includes('approveRelationships'))
assert('composable exposes retireRelationships bulk', composablePass25.includes('retireRelationships'))
assert('bulk approve entities uses approveEntity', composablePass25.includes('await approveEntity(id)'))

const panelPass25 = read('components/project/ProductionBiblePanel.vue')
assert('panel tentative items section', panelPass25.includes('Tentative items'))
assert('panel tentative bulk approve selected', panelPass25.includes('onBulkApproveTentativeSelected'))
assert('panel tentative bulk retire all visible', panelPass25.includes('onBulkRetireAllVisibleTentative'))
assert('panel tentative checkboxes', panelPass25.includes('toggleTentativeItemSelection'))
assert('panel tentative type filter', panelPass25.includes('tentativeItemFilters.kind'))
assert('panel tentative confirmation', panelPass25.includes('confirmBulkTentativeAction'))
assert('panel keeps one-by-one entity approve', panelPass25.includes('onApproveEntity'))
assert('panel keeps one-by-one rel approve', panelPass25.includes('onApproveRel'))

assert('design doc has PASS 25 note', doc.includes('PASS 25'))

const storyboard = read('pages/projects/[projectId]/storyboard.vue')
assert('storyboard loads bible context for frames', storyboard.includes('loadBibleContextForFrame'))
assert('storyboard passes productionBible to frame prompt', storyboard.includes('productionBible: productionBibleCtx'))
assert('storyboard shows bible debug label', storyboard.includes('frameBibleDebug'))
assert('composable exposes loadContextForPrompt', composable.includes('loadContextForPrompt'))

let failed = 0
for (const c of checks) {
  const mark = c.ok ? '✓' : '✗'
  if (!c.ok) failed++
  console.log(`${mark} ${c.name}`)
}

console.log(`\n${checks.length} checks, ${failed} failed`)
process.exit(failed ? 1 : 0)
