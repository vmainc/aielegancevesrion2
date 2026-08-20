<script setup lang="ts">
import { castBibleConfidenceLabel } from '~/lib/bible-cast-bridge'
import type { BibleCastLinkResult } from '~/types/bible-cast-link-result'
import type { BibleSeedResult } from '~/types/bible-seed-result'
import type { BibleSeedRemediationResult } from '~/types/bible-seed-remediation-result'
import type { LegacyAssetPromptRedactionResult } from '~/types/legacy-asset-prompt-redaction-result'

defineProps<{
  seedModalOpen: boolean
  seedPreview: BibleSeedResult | null
  seeding: boolean
  legacyRemediationModalOpen: boolean
  legacyRemediationPreview: BibleSeedRemediationResult | null
  legacyRemediating: boolean
  legacyPromptRedactionModalOpen: boolean
  legacyPromptRedactionPreview: LegacyAssetPromptRedactionResult | null
  legacyPromptRedacting: boolean
  castLinkModalOpen: boolean
  castLinkPreview: BibleCastLinkResult | null
  castLinking: boolean
  factStatusLabel: (status: string) => string
}>()

const emit = defineEmits<{
  'update:seedModalOpen': [value: boolean]
  'apply-seed': []
  'update:legacyRemediationModalOpen': [value: boolean]
  'apply-legacy-remediation': []
  'update:legacyPromptRedactionModalOpen': [value: boolean]
  'apply-legacy-prompt-redaction': []
  'update:castLinkModalOpen': [value: boolean]
  'apply-cast-link': []
}>()

function castLinkConfidenceClass (confidence?: string): string {
  if (confidence === 'explicit' || confidence === 'relationship') {
    return 'bg-emerald-100 text-emerald-900'
  }
  if (confidence === 'name') return 'bg-sky-100 text-sky-900'
  if (confidence === 'ambiguous') return 'bg-amber-100 text-amber-900'
  return 'bg-gray-100 text-gray-700'
}
</script>

<template>
  <div
    v-if="seedModalOpen && seedPreview"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
    role="dialog"
    aria-modal="true"
    aria-labelledby="seed-modal-title"
    @click.self="emit('update:seedModalOpen', false)"
  >
    <div class="w-full max-w-lg rounded-xl border border-gray-200 bg-studio-slate shadow-xl p-5 sm:p-6 max-h-[85vh] overflow-y-auto">
      <h2 id="seed-modal-title" class="text-lg font-semibold text-gray-900 mb-1">
        {{ seedPreview.dryRun ? 'Seed preview' : 'Seed complete' }}
      </h2>
      <p class="text-xs text-gray-500 mb-4">
        Existing bible entries are never overwritten. Duplicates are skipped.
        New entities and relationships are <strong>Tentative</strong>; facts are
        <strong>Needs Review</strong> until you approve them in the Production Bible.
      </p>

      <dl class="grid grid-cols-2 gap-3 text-sm mb-4">
        <div class="rounded-lg bg-gray-50 px-3 py-2">
          <dt class="text-gray-500 text-xs">Entities created (tentative)</dt>
          <dd class="font-semibold text-gray-900">{{ seedPreview.entitiesCreated }}</dd>
        </div>
        <div class="rounded-lg bg-gray-50 px-3 py-2">
          <dt class="text-gray-500 text-xs">Entities skipped</dt>
          <dd class="font-semibold text-gray-900">{{ seedPreview.entitiesSkippedDuplicate }}</dd>
        </div>
        <div class="rounded-lg bg-gray-50 px-3 py-2">
          <dt class="text-gray-500 text-xs">Facts created (needs review)</dt>
          <dd class="font-semibold text-gray-900">{{ seedPreview.factsCreated }}</dd>
        </div>
        <div class="rounded-lg bg-gray-50 px-3 py-2">
          <dt class="text-gray-500 text-xs">Facts skipped</dt>
          <dd class="font-semibold text-gray-900">{{ seedPreview.factsSkippedDuplicate }}</dd>
        </div>
        <div class="rounded-lg bg-gray-50 px-3 py-2">
          <dt class="text-gray-500 text-xs">Relationships created (tentative)</dt>
          <dd class="font-semibold text-gray-900">{{ seedPreview.relationshipsCreated }}</dd>
        </div>
        <div class="rounded-lg bg-gray-50 px-3 py-2">
          <dt class="text-gray-500 text-xs">Relationships skipped</dt>
          <dd class="font-semibold text-gray-900">{{ seedPreview.relationshipsSkippedDuplicate }}</dd>
        </div>
      </dl>

      <div v-if="seedPreview.created.entities.length" class="mb-3">
        <p class="text-xs font-semibold text-gray-700 mb-1">New entities (tentative)</p>
        <ul class="text-xs text-gray-600 space-y-0.5 max-h-24 overflow-y-auto">
          <li v-for="(e, i) in seedPreview.created.entities.slice(0, 20)" :key="i">
            {{ e.type }}: {{ e.name }}
            <span class="text-sky-700">· {{ factStatusLabel(e.status) }}</span>
          </li>
        </ul>
      </div>

      <div v-if="seedPreview.created.facts.length" class="mb-3">
        <p class="text-xs font-semibold text-gray-700 mb-1">New facts (needs review)</p>
        <ul class="text-xs text-gray-600 space-y-0.5 max-h-24 overflow-y-auto">
          <li v-for="(f, i) in seedPreview.created.facts.slice(0, 20)" :key="i">
            {{ f.entityName }}: {{ f.statement.slice(0, 80) }}{{ f.statement.length > 80 ? '…' : '' }}
            <span class="text-amber-800">· {{ factStatusLabel(f.status) }}</span>
          </li>
        </ul>
      </div>

      <div v-if="seedPreview.created.relationships.length" class="mb-3">
        <p class="text-xs font-semibold text-gray-700 mb-1">New relationships (tentative)</p>
        <ul class="text-xs text-gray-600 space-y-0.5 max-h-20 overflow-y-auto">
          <li v-for="(r, i) in seedPreview.created.relationships.slice(0, 15)" :key="i">
            {{ r.summary }}
            <span class="text-sky-700">· {{ factStatusLabel(r.status) }}</span>
          </li>
        </ul>
      </div>

      <div v-if="seedPreview.unsupported.length" class="mb-3">
        <p class="text-xs font-semibold text-amber-800 mb-1">Skipped / unsupported</p>
        <ul class="text-xs text-amber-900 space-y-0.5 max-h-20 overflow-y-auto">
          <li v-for="(msg, i) in seedPreview.unsupported.slice(0, 10)" :key="i">{{ msg }}</li>
        </ul>
      </div>

      <div class="flex flex-wrap justify-end gap-2 pt-2 border-t border-gray-100">
        <button
          type="button"
          class="px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          @click="emit('update:seedModalOpen', false)"
        >
          Close
        </button>
        <button
          v-if="seedPreview.dryRun"
          type="button"
          class="px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-gray-950 disabled:opacity-50"
          :disabled="seeding"
          @click="emit('apply-seed')"
        >
          {{ seeding ? 'Seeding…' : 'Create entries' }}
        </button>
      </div>
    </div>
  </div>

  <div
    v-if="legacyRemediationModalOpen && legacyRemediationPreview"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
    role="dialog"
    aria-modal="true"
    aria-labelledby="legacy-remediation-title"
    @click.self="emit('update:legacyRemediationModalOpen', false)"
  >
    <div class="w-full max-w-lg rounded-xl border border-amber-200 bg-studio-slate shadow-xl p-5 sm:p-6 max-h-[85vh] overflow-y-auto">
      <h2 id="legacy-remediation-title" class="text-lg font-semibold text-gray-900 mb-1">
        {{ legacyRemediationPreview.dryRun ? 'Legacy seeded facts preview' : 'Legacy remediation complete' }}
      </h2>
      <p class="text-xs text-amber-900/90 mb-4">
        This moves old auto-seeded facts back into review so they do not affect prompts until approved.
        User-authored and continuity facts are not changed.
      </p>

      <dl class="grid grid-cols-2 gap-3 text-sm mb-4">
        <div class="rounded-lg bg-amber-50 px-3 py-2">
          <dt class="text-gray-500 text-xs">Facts found</dt>
          <dd class="font-semibold text-gray-900">{{ legacyRemediationPreview.foundCount }}</dd>
        </div>
        <div class="rounded-lg bg-amber-50 px-3 py-2">
          <dt class="text-gray-500 text-xs">Target status</dt>
          <dd class="font-semibold text-gray-900">{{ factStatusLabel(legacyRemediationPreview.targetStatus) }}</dd>
        </div>
        <div v-if="!legacyRemediationPreview.dryRun" class="rounded-lg bg-gray-50 px-3 py-2">
          <dt class="text-gray-500 text-xs">Updated</dt>
          <dd class="font-semibold text-gray-900">{{ legacyRemediationPreview.updatedCount }}</dd>
        </div>
        <div v-if="!legacyRemediationPreview.dryRun" class="rounded-lg bg-gray-50 px-3 py-2">
          <dt class="text-gray-500 text-xs">Skipped</dt>
          <dd class="font-semibold text-gray-900">{{ legacyRemediationPreview.skippedCount }}</dd>
        </div>
      </dl>

      <div v-if="legacyRemediationPreview.samples.length" class="mb-3">
        <p class="text-xs font-semibold text-gray-700 mb-1">Sample facts</p>
        <ul class="text-xs text-gray-600 space-y-1 max-h-40 overflow-y-auto">
          <li v-for="s in legacyRemediationPreview.samples" :key="s.id">
            {{ s.statement }}
            <span class="text-amber-800">· {{ factStatusLabel(s.currentStatus) }} → {{ factStatusLabel(s.targetStatus) }}</span>
          </li>
        </ul>
      </div>

      <div class="flex flex-wrap justify-end gap-2 pt-2 border-t border-gray-100">
        <button
          type="button"
          class="px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          @click="emit('update:legacyRemediationModalOpen', false)"
        >
          Close
        </button>
        <button
          v-if="legacyRemediationPreview.dryRun && legacyRemediationPreview.foundCount > 0"
          type="button"
          class="px-4 py-2 text-sm font-semibold rounded-lg bg-amber-600 text-white disabled:opacity-50"
          :disabled="legacyRemediating"
          @click="emit('apply-legacy-remediation')"
        >
          {{ legacyRemediating ? 'Working…' : 'Move to needs review' }}
        </button>
      </div>
    </div>
  </div>

  <div
    v-if="legacyPromptRedactionModalOpen && legacyPromptRedactionPreview"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
    role="dialog"
    aria-modal="true"
    aria-labelledby="legacy-prompt-redaction-title"
    @click.self="emit('update:legacyPromptRedactionModalOpen', false)"
  >
    <div class="w-full max-w-lg rounded-xl border border-rose-200 bg-studio-slate shadow-xl p-5 sm:p-6 max-h-[85vh] overflow-y-auto">
      <h2 id="legacy-prompt-redaction-title" class="text-lg font-semibold text-gray-900 mb-1">
        {{ legacyPromptRedactionPreview.dryRun ? 'Legacy prompt metadata preview' : 'Legacy prompt redaction complete' }}
      </h2>
      <p class="text-xs text-rose-900/90 mb-4">
        This removes old full prompt text from asset metadata and keeps only hashes/markers.
        <code class="text-[10px]">generation_observability</code> and other non-prompt fields are preserved. Assets are not deleted.
      </p>

      <dl class="grid grid-cols-2 gap-3 text-sm mb-4">
        <div class="rounded-lg bg-rose-50 px-3 py-2">
          <dt class="text-gray-500 text-xs">Assets affected</dt>
          <dd class="font-semibold text-gray-900">{{ legacyPromptRedactionPreview.assetsAffected }}</dd>
        </div>
        <div class="rounded-lg bg-rose-50 px-3 py-2 col-span-2 sm:col-span-1">
          <dt class="text-gray-500 text-xs">Fields found</dt>
          <dd class="font-semibold text-gray-900 text-xs">
            {{ legacyPromptRedactionPreview.fieldsFound.length ? legacyPromptRedactionPreview.fieldsFound.join(', ') : '—' }}
          </dd>
        </div>
        <div v-if="!legacyPromptRedactionPreview.dryRun" class="rounded-lg bg-gray-50 px-3 py-2">
          <dt class="text-gray-500 text-xs">Updated</dt>
          <dd class="font-semibold text-gray-900">{{ legacyPromptRedactionPreview.updatedCount }}</dd>
        </div>
        <div v-if="!legacyPromptRedactionPreview.dryRun" class="rounded-lg bg-gray-50 px-3 py-2">
          <dt class="text-gray-500 text-xs">Remaining leaks</dt>
          <dd class="font-semibold text-gray-900">{{ legacyPromptRedactionPreview.remainingLeakCount }}</dd>
        </div>
      </dl>

      <p class="text-xs text-gray-600 mb-3">
        {{ legacyPromptRedactionPreview.replacementDescription }}
      </p>

      <div v-if="legacyPromptRedactionPreview.samples.length" class="mb-3">
        <p class="text-xs font-semibold text-gray-700 mb-1">Sample assets</p>
        <ul class="text-xs text-gray-600 space-y-2 max-h-40 overflow-y-auto">
          <li
            v-for="s in legacyPromptRedactionPreview.samples"
            :key="s.assetId"
            class="rounded-md border border-gray-100 px-2 py-1.5"
          >
            <span class="font-medium text-gray-800">{{ s.title || s.kind }}</span>
            <span class="text-gray-400"> · {{ s.assetId.slice(0, 8) }}…</span>
            <p class="text-[11px] text-rose-900/80 mt-0.5">
              {{ s.fields.join(', ') }}
            </p>
          </li>
        </ul>
      </div>

      <div class="flex flex-wrap justify-end gap-2 pt-2 border-t border-gray-100">
        <button
          type="button"
          class="px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          @click="emit('update:legacyPromptRedactionModalOpen', false)"
        >
          Close
        </button>
        <button
          v-if="legacyPromptRedactionPreview.dryRun && legacyPromptRedactionPreview.assetsAffected > 0"
          type="button"
          class="px-4 py-2 text-sm font-semibold rounded-lg bg-rose-700 text-white disabled:opacity-50"
          :disabled="legacyPromptRedacting"
          @click="emit('apply-legacy-prompt-redaction')"
        >
          {{ legacyPromptRedacting ? 'Working…' : 'Redact prompt metadata' }}
        </button>
      </div>
    </div>
  </div>

  <div
    v-if="castLinkModalOpen && castLinkPreview"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
    role="dialog"
    aria-modal="true"
    aria-labelledby="cast-link-title"
    @click.self="emit('update:castLinkModalOpen', false)"
  >
    <div class="w-full max-w-lg rounded-xl border border-sky-200 bg-studio-slate shadow-xl p-5 sm:p-6 max-h-[85vh] overflow-y-auto">
      <h2 id="cast-link-title" class="text-lg font-semibold text-gray-900 mb-1">
        {{ castLinkPreview.dryRun ? 'Link cast preview' : 'Cast link complete' }}
      </h2>
      <p class="text-xs text-sky-900/90 mb-4">
        Links project cast records to Bible character entities. User-authored entities and conflicting links are skipped.
        New entities are created as tentative with metadata only — cast rows are never modified.
      </p>

      <dl class="grid grid-cols-2 gap-3 text-sm mb-4">
        <div class="rounded-lg bg-gray-50 px-3 py-2">
          <dt class="text-gray-500 text-xs">Already linked</dt>
          <dd class="font-semibold text-gray-900">{{ castLinkPreview.matchedCount }}</dd>
        </div>
        <div class="rounded-lg bg-sky-50 px-3 py-2">
          <dt class="text-gray-500 text-xs">Newly linked</dt>
          <dd class="font-semibold text-gray-900">{{ castLinkPreview.linkedCount }}</dd>
        </div>
        <div class="rounded-lg bg-emerald-50 px-3 py-2">
          <dt class="text-gray-500 text-xs">Created</dt>
          <dd class="font-semibold text-gray-900">{{ castLinkPreview.createdCount }}</dd>
        </div>
        <div class="rounded-lg bg-amber-50 px-3 py-2">
          <dt class="text-gray-500 text-xs">Ambiguous</dt>
          <dd class="font-semibold text-gray-900">{{ castLinkPreview.ambiguousCount }}</dd>
        </div>
        <div class="rounded-lg bg-gray-50 px-3 py-2 col-span-2">
          <dt class="text-gray-500 text-xs">Skipped</dt>
          <dd class="font-semibold text-gray-900">{{ castLinkPreview.skippedCount }}</dd>
        </div>
      </dl>

      <div v-if="castLinkPreview.linked.length" class="mb-3">
        <p class="text-xs font-semibold text-gray-700 mb-1">Newly linked</p>
        <ul class="text-xs text-gray-600 space-y-1 max-h-32 overflow-y-auto">
          <li v-for="row in castLinkPreview.linked" :key="row.characterId">
            {{ row.characterName }} → {{ row.entityName }}
            <span
              v-if="row.confidence"
              class="ml-1 font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
              :class="castLinkConfidenceClass(row.confidence)"
            >
              {{ castBibleConfidenceLabel(row.confidence) }}
            </span>
          </li>
        </ul>
      </div>

      <div v-if="castLinkPreview.created.length" class="mb-3">
        <p class="text-xs font-semibold text-gray-700 mb-1">Created entities</p>
        <ul class="text-xs text-gray-600 space-y-1 max-h-32 overflow-y-auto">
          <li v-for="row in castLinkPreview.created" :key="row.characterId">
            {{ row.characterName }}
          </li>
        </ul>
      </div>

      <div v-if="castLinkPreview.ambiguous.length" class="mb-3">
        <p class="text-xs font-semibold text-amber-800 mb-1">Ambiguous (manual review needed)</p>
        <ul class="text-xs text-amber-900 space-y-1 max-h-32 overflow-y-auto">
          <li v-for="row in castLinkPreview.ambiguous" :key="row.characterId">
            {{ row.characterName }} — {{ row.candidateEntityIds?.length || 0 }} bible entities share this name
          </li>
        </ul>
      </div>

      <div v-if="castLinkPreview.skipped.length" class="mb-3">
        <p class="text-xs font-semibold text-gray-700 mb-1">Skipped</p>
        <ul class="text-xs text-gray-600 space-y-1 max-h-32 overflow-y-auto">
          <li v-for="row in castLinkPreview.skipped" :key="row.characterId">
            {{ row.characterName }} — {{ row.reason }}
          </li>
        </ul>
      </div>

      <div class="flex flex-wrap justify-end gap-2 pt-2 border-t border-gray-100">
        <button
          type="button"
          class="px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          @click="emit('update:castLinkModalOpen', false)"
        >
          Close
        </button>
        <button
          v-if="castLinkPreview.dryRun && (castLinkPreview.linkedCount > 0 || castLinkPreview.createdCount > 0)"
          type="button"
          class="px-4 py-2 text-sm font-semibold rounded-lg bg-sky-600 text-white disabled:opacity-50"
          :disabled="castLinking"
          @click="emit('apply-cast-link')"
        >
          {{ castLinking ? 'Working…' : 'Apply links' }}
        </button>
      </div>
    </div>
  </div>
</template>
