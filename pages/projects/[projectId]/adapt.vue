<template>
  <div class="max-w-4xl relative">
    <div class="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl sm:text-2xl font-bold text-gray-900">Adapt to Film</h1>
        <p class="text-sm text-gray-500 mt-1">{{ adapt?.projectTitle || 'Film adaptation workspace' }}</p>
      </div>
      <p class="text-xs text-gray-500" aria-live="polite">
        <span v-if="saveStatus === 'saving'">Saving…</span>
        <span v-else-if="saveStatus === 'saved'" class="text-emerald-700">Saved</span>
        <span v-else-if="saveStatus === 'error'" class="text-red-700">Save failed</span>
      </p>
    </div>

    <div v-if="loadError" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 mb-6" role="alert">
      {{ loadError }}
    </div>
    <div v-else-if="!adapt" class="rounded-xl border border-gray-200 bg-white px-4 py-10">
      <FilmReelLoader size="sm" label="Loading adaptation" sub-label="Fetching Adapt to Film state…" />
    </div>

    <template v-else>
      <nav class="mb-6 overflow-x-auto" aria-label="Adaptation stages">
        <ol class="flex gap-1 min-w-max">
          <li v-for="(st, i) in ADAPT_STAGES" :key="st">
            <button
              type="button"
              class="px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors"
              :class="adapt.stage === st ? 'bg-primary text-gray-950' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
              @click="goToStage(st)"
            >
              {{ i + 1 }}. {{ ADAPT_STAGE_LABELS[st] }}
            </button>
          </li>
        </ol>
      </nav>

      <!-- Source -->
      <section v-if="adapt.stage === 'source'" class="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Project title</label>
          <input v-model="adapt.projectTitle" type="text" :class="fieldClass" @input="scheduleSave">
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Source title</label>
            <input v-model="adapt.sourceMeta.sourceTitle" type="text" :class="fieldClass" @input="scheduleSave">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Source type</label>
            <select v-model="adapt.sourceMeta.sourceType" :class="fieldClass" @change="scheduleSave">
              <option v-for="opt in ADAPT_SOURCE_TYPES" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Author</label>
            <input v-model="adapt.sourceMeta.sourceAuthor" type="text" :class="fieldClass" @input="scheduleSave">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
            <input v-model="adapt.sourceMeta.sourceDate" type="text" :class="fieldClass" @input="scheduleSave">
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
          <textarea v-model="adapt.sourceMeta.sourceNotes" rows="2" :class="fieldClass" @input="scheduleSave" />
        </div>
        <div>
          <div class="flex justify-between gap-2 mb-1.5">
            <label class="text-sm font-medium text-gray-700">Working source text</label>
            <span class="text-xs text-gray-500">
              {{ countWords(adapt.workingSourceText).toLocaleString() }} words ·
              {{ adapt.workingSourceText.length.toLocaleString() }} chars
            </span>
          </div>
          <textarea
            ref="workingSourceEl"
            v-model="adapt.workingSourceText"
            rows="12"
            :class="`${fieldClass} min-h-[12rem] leading-relaxed`"
            @input="scheduleSave"
          />
        </div>
        <details
          v-if="showOriginalSource"
          class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
        >
          <summary class="text-sm font-medium text-gray-700 cursor-pointer">Original source</summary>
          <pre class="mt-2 text-xs text-gray-600 whitespace-pre-wrap max-h-48 overflow-y-auto">{{ adapt.originalSourceText }}</pre>
        </details>
        <button type="button" :class="btnPrimary" @click="continueFromSource">Continue to Adaptation</button>
      </section>

      <!-- Adaptation -->
      <section v-else-if="adapt.stage === 'adaptation'" class="rounded-xl border border-gray-200 bg-white p-5 space-y-5">
        <fieldset>
          <legend class="text-sm font-semibold text-gray-900 mb-2">Adaptation type</legend>
          <div class="grid gap-2 sm:grid-cols-2">
            <label
              v-for="opt in ADAPT_TYPES"
              :key="opt.value"
              class="flex items-start gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer"
              :class="adapt.settings.adaptationType === opt.value ? 'border-primary bg-primary/5' : 'border-gray-200 hover:bg-gray-50'"
            >
              <input
                v-model="adapt.settings.adaptationType"
                type="radio"
                :value="opt.value"
                class="mt-1 text-primary focus:ring-primary"
                @change="scheduleSave"
              >
              <span>
                <span class="block text-sm font-medium text-gray-900">{{ opt.label }}</span>
                <span class="block text-xs text-gray-500 mt-0.5">{{ opt.description }}</span>
              </span>
            </label>
          </div>
          <input
            v-if="adapt.settings.adaptationType === 'custom'"
            v-model="adapt.settings.adaptationTypeCustom"
            type="text"
            :class="`${fieldClass} mt-2`"
            placeholder="Custom adaptation type"
            @input="scheduleSave"
          >
        </fieldset>

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Target length</label>
            <select v-model="adapt.settings.targetLength" :class="fieldClass" @change="scheduleSave">
              <option v-for="opt in ADAPT_TARGET_LENGTHS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
            <input
              v-if="adapt.settings.targetLength === 'custom'"
              v-model.number="adapt.settings.targetMinutesCustom"
              type="number"
              min="0.5"
              step="0.5"
              :class="`${fieldClass} mt-2`"
              placeholder="Minutes"
              @input="scheduleSave"
            >
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Aspect ratio</label>
            <select v-model="adapt.settings.aspectRatio" :class="fieldClass" @change="scheduleSave">
              <option v-for="ar in ADAPT_ASPECT_RATIOS" :key="ar" :value="ar">{{ ar }}</option>
            </select>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Visual style</label>
          <select v-model="adapt.settings.visualStyle" :class="fieldClass" @change="scheduleSave">
            <option v-for="preset in ADAPT_VISUAL_STYLE_PRESETS" :key="preset" :value="preset">{{ preset }}</option>
          </select>
          <input
            v-if="adapt.settings.visualStyle === 'Custom'"
            v-model="adapt.settings.visualStyleCustom"
            type="text"
            :class="`${fieldClass} mt-2`"
            placeholder="Custom visual style"
            @input="scheduleSave"
          >
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Narrative approach</label>
          <select v-model="adapt.settings.narrativeApproach" :class="fieldClass" @change="scheduleSave">
            <option v-for="opt in ADAPT_NARRATIVE_APPROACHES" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>

        <fieldset>
          <legend class="text-sm font-semibold text-gray-900 mb-2">Source fidelity</legend>
          <div class="grid gap-2 sm:grid-cols-3">
            <label
              v-for="opt in ADAPT_FIDELITY_OPTIONS"
              :key="opt.value"
              class="flex items-start gap-2 rounded-lg border px-3 py-2.5 cursor-pointer"
              :class="adapt.settings.sourceFidelity === opt.value ? 'border-primary bg-primary/5' : 'border-gray-200 hover:bg-gray-50'"
            >
              <input
                v-model="adapt.settings.sourceFidelity"
                type="radio"
                :value="opt.value"
                class="mt-1 text-primary focus:ring-primary"
                @change="scheduleSave"
              >
              <span>
                <span class="block text-sm font-medium text-gray-900">{{ opt.label }}</span>
                <span class="block text-xs text-gray-500 mt-0.5">{{ opt.description }}</span>
              </span>
            </label>
          </div>
        </fieldset>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Additional instructions</label>
          <textarea
            v-model="adapt.settings.additionalInstructions"
            rows="4"
            :class="fieldClass"
            placeholder="Tone, must-keep facts, things to avoid…"
            @input="scheduleSave"
          />
        </div>
        <div class="flex flex-wrap gap-3">
          <button type="button" :class="btnSecondary" @click="saveNow">Save</button>
          <button type="button" :class="btnPrimary" @click="setStage('treatment')">Continue to Treatment</button>
        </div>
      </section>

      <!-- Treatment -->
      <section v-else-if="adapt.stage === 'treatment'" class="space-y-4">
        <div
          v-if="adapt.longSourceWarning"
          class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {{ adapt.longSourceWarning }}
        </div>
        <div class="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              :class="btnPrimary"
              :disabled="generating"
              @click="runGenerate({ kind: 'treatment', versionMode: 'new' })"
            >
              Generate Treatment
            </button>
            <button
              type="button"
              :class="btnSecondary"
              :disabled="generating || !activeTreatment"
              @click="runGenerate({ kind: 'treatment', versionMode: 'replace' })"
            >
              Regenerate (replace)
            </button>
            <button
              type="button"
              :class="btnSecondary"
              :disabled="generating || !activeTreatment"
              @click="runGenerate({ kind: 'treatment', versionMode: 'new' })"
            >
              Regenerate (new version)
            </button>
          </div>
          <template v-if="activeTreatment">
            <p class="text-xs text-gray-500">
              Version {{ activeTreatment.version }}
              <span v-if="activeTreatment.approved" class="text-emerald-700 font-medium">· Approved</span>
            </p>
            <div v-for="field in treatmentFields" :key="field.key" class="space-y-1">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <label class="text-sm font-medium text-gray-700">{{ field.label }}</label>
                <button
                  v-if="field.regen"
                  type="button"
                  class="text-xs font-medium text-primary hover:underline"
                  :disabled="generating"
                  @click="runGenerate({ kind: 'treatment_section', sectionKey: field.key })"
                >
                  Regenerate
                </button>
              </div>
              <textarea
                :value="String(activeTreatment.content[field.key] ?? '')"
                :rows="field.rows"
                :class="fieldClass"
                @input="onTreatmentField(field.key, $event)"
              />
            </div>
            <button type="button" :class="btnPrimary" @click="approveTreatmentAndContinue">
              Approve and Continue to Scenes
            </button>
          </template>
          <p v-else class="text-sm text-gray-500">Generate a treatment to begin editing.</p>
        </div>
      </section>

      <!-- Scenes -->
      <section v-else-if="adapt.stage === 'scenes'" class="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-sm font-medium text-gray-900">
              Duration: {{ formatSeconds(sumSceneDurationSeconds(adapt.scenes)) }}
              / {{ formatSeconds(targetRuntimeSeconds(adapt.settings)) }} target
            </p>
            <p v-if="sceneDurationWarning" class="text-xs text-amber-800 mt-1">{{ sceneDurationWarning }}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button type="button" :class="btnPrimary" :disabled="generating" @click="runGenerate({ kind: 'scenes' })">
              Generate Scenes
            </button>
            <button type="button" :class="btnSecondary" @click="addScene">Add scene</button>
          </div>
        </div>

        <div v-for="(scene, idx) in adapt.scenes" :key="scene.id" class="rounded-lg border border-gray-200 overflow-hidden">
          <button
            type="button"
            class="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left bg-gray-50 hover:bg-gray-100"
            @click="toggleExpand(`scene-${scene.id}`)"
          >
            <span class="text-sm font-medium text-gray-900">
              {{ scene.sceneNumber }}. {{ scene.title || 'Untitled' }}
              <span class="ml-2 text-xs font-normal text-gray-500">{{ scene.status }}</span>
            </span>
            <span class="text-xs text-gray-500">{{ formatSeconds(scene.estimatedDurationSeconds) }}</span>
          </button>
          <div v-if="expanded[`scene-${scene.id}`]" class="p-3 space-y-3 border-t border-gray-200">
            <div class="grid gap-3 sm:grid-cols-2">
              <div>
                <label :class="labelClass">Title</label>
                <input v-model="scene.title" type="text" :class="fieldClass" @input="scheduleSave">
              </div>
              <div>
                <label :class="labelClass">Duration (sec)</label>
                <input v-model.number="scene.estimatedDurationSeconds" type="number" min="0" :class="fieldClass" @input="scheduleSave">
              </div>
            </div>
            <div>
              <label :class="labelClass">Summary</label>
              <textarea v-model="scene.summary" rows="2" :class="fieldClass" @input="scheduleSave" />
            </div>
            <div>
              <label :class="labelClass">Visual description</label>
              <textarea v-model="scene.visualDescription" rows="3" :class="fieldClass" @input="scheduleSave" />
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
              <div>
                <label :class="labelClass">Narration</label>
                <textarea v-model="scene.narration" rows="2" :class="fieldClass" @input="scheduleSave" />
              </div>
              <div>
                <label :class="labelClass">Dialogue</label>
                <textarea v-model="scene.dialogue" rows="2" :class="fieldClass" @input="scheduleSave" />
              </div>
            </div>
            <div class="grid gap-3 sm:grid-cols-3">
              <div>
                <label :class="labelClass">Source fidelity</label>
                <select v-model="scene.sourceFidelity" :class="fieldClass" @change="scheduleSave">
                  <option v-for="f in SCENE_FIDELITY" :key="f" :value="f">{{ f }}</option>
                </select>
              </div>
              <div>
                <label :class="labelClass">Status</label>
                <select v-model="scene.status" :class="fieldClass" @change="scheduleSave">
                  <option v-for="s in SCENE_STATUSES" :key="s" :value="s">{{ s }}</option>
                </select>
              </div>
              <label class="flex items-center gap-2 text-sm text-gray-700 pt-6">
                <input v-model="scene.locked" type="checkbox" class="rounded border-gray-300 text-primary focus:ring-primary" @change="scheduleSave">
                Locked
              </label>
            </div>
            <div v-if="scene.sourceRefs?.length" class="text-xs text-gray-600 space-y-1">
              <p class="font-medium text-gray-700">Source excerpt</p>
              <p class="italic">{{ scene.sourceRefs[0]?.excerpt }}</p>
              <button type="button" class="text-primary font-medium hover:underline" @click="viewInSource(scene)">
                View in Source
              </button>
            </div>
            <div class="flex flex-wrap gap-2">
              <button type="button" :class="btnTiny" @click="approveScene(scene)">Approve</button>
              <button type="button" :class="btnTiny" :disabled="generating || scene.locked" @click="runGenerate({ kind: 'scene', sceneId: scene.id })">Regenerate</button>
              <button type="button" :class="btnTiny" @click="duplicateScene(idx)">Duplicate</button>
              <button type="button" :class="`${btnTiny} text-red-700`" @click="deleteScene(idx)">Delete</button>
            </div>
          </div>
        </div>
        <button type="button" :class="btnPrimary" :disabled="!adapt.scenes.length" @click="setStage('shots')">
          Continue to Shots
        </button>
      </section>

      <!-- Shots -->
      <section v-else-if="adapt.stage === 'shots'" class="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        <button type="button" :class="btnPrimary" :disabled="generating" @click="runGenerate({ kind: 'shots' })">
          Generate shots for all approved scenes
        </button>
        <div v-for="scene in adapt.scenes" :key="`shots-${scene.id}`" class="rounded-lg border border-gray-200 p-3 space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3 class="text-sm font-semibold text-gray-900">Scene {{ scene.sceneNumber }}: {{ scene.title }}</h3>
            <button
              type="button"
              :class="btnTiny"
              :disabled="generating || scene.locked"
              @click="runGenerate({ kind: 'shots', sceneId: scene.id })"
            >
              Generate shots
            </button>
          </div>
          <div
            v-for="shot in shotsForScene(scene.id)"
            :key="shot.id"
            class="rounded-md border border-gray-100 bg-gray-50/80 p-3 space-y-2"
          >
            <button type="button" class="w-full text-left text-sm font-medium text-gray-900" @click="toggleExpand(`shot-${shot.id}`)">
              Shot {{ shot.shotNumber }}: {{ shot.title || shot.shotType || 'Untitled' }}
              <span class="text-xs font-normal text-gray-500 ml-2">{{ shot.status }}</span>
            </button>
            <div v-if="expanded[`shot-${shot.id}`]" class="space-y-2 pt-1">
              <div class="grid gap-2 sm:grid-cols-2">
                <div>
                  <label :class="labelClass">Title</label>
                  <input v-model="shot.title" type="text" :class="fieldClass" @input="scheduleSave">
                </div>
                <div>
                  <label :class="labelClass">Shot type</label>
                  <input v-model="shot.shotType" type="text" :class="fieldClass" @input="scheduleSave">
                </div>
              </div>
              <div>
                <label :class="labelClass">Visual description</label>
                <textarea v-model="shot.visualDescription" rows="2" :class="fieldClass" @input="scheduleSave" />
              </div>
              <div>
                <label :class="labelClass">Image prompt</label>
                <textarea v-model="shot.imagePrompt" rows="2" :class="fieldClass" @input="scheduleSave" />
              </div>
              <div>
                <label :class="labelClass">Video prompt</label>
                <textarea v-model="shot.videoPrompt" rows="2" :class="fieldClass" @input="scheduleSave" />
              </div>
              <div>
                <label :class="labelClass">Ending frame</label>
                <textarea v-model="shot.endingFrameDescription" rows="2" :class="fieldClass" @input="scheduleSave" />
              </div>
              <div class="grid gap-2 sm:grid-cols-3">
                <div>
                  <label :class="labelClass">Duration (sec)</label>
                  <input v-model.number="shot.estimatedDurationSeconds" type="number" min="0" :class="fieldClass" @input="scheduleSave">
                </div>
                <div>
                  <label :class="labelClass">Status</label>
                  <select v-model="shot.status" :class="fieldClass" @change="scheduleSave">
                    <option v-for="s in SHOT_STATUSES" :key="s" :value="s">{{ s }}</option>
                  </select>
                </div>
                <label class="flex items-center gap-2 text-sm text-gray-700 pt-6">
                  <input v-model="shot.locked" type="checkbox" class="rounded border-gray-300 text-primary focus:ring-primary" @change="scheduleSave">
                  Locked
                </label>
              </div>
              <div class="flex flex-wrap gap-2">
                <button type="button" :class="btnTiny" :disabled="generating || shot.locked" @click="runGenerate({ kind: 'shot', shotId: shot.id })">Regenerate shot</button>
                <button type="button" :class="btnTiny" :disabled="generating || shot.locked" @click="runGenerate({ kind: 'shot_prompt', shotId: shot.id, promptWhich: 'image' })">Regen image prompt</button>
                <button type="button" :class="btnTiny" :disabled="generating || shot.locked" @click="runGenerate({ kind: 'shot_prompt', shotId: shot.id, promptWhich: 'video' })">Regen video prompt</button>
              </div>
            </div>
          </div>
          <p v-if="!shotsForScene(scene.id).length" class="text-xs text-gray-500">No shots yet.</p>
        </div>
        <button type="button" :class="btnPrimary" @click="setStage('production')">Continue to Production Plan</button>
      </section>

      <!-- Production -->
      <section v-else-if="adapt.stage === 'production'" class="space-y-5">
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div v-for="card in productionCards" :key="card.label" class="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p class="text-xs text-gray-500 uppercase tracking-wide">{{ card.label }}</p>
            <p class="text-lg font-semibold text-gray-900 mt-1">{{ card.value }}</p>
          </div>
        </div>
        <div
          v-if="prodSummary?.continuityWarnings?.length"
          class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 space-y-1"
        >
          <p v-for="(w, i) in prodSummary.continuityWarnings" :key="i">{{ w }}</p>
        </div>
        <div class="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
          <h2 class="text-sm font-semibold text-gray-900">Production checklist</h2>
          <label
            v-for="item in adapt.checklist"
            :key="item.id"
            class="flex items-start gap-2.5 text-sm text-gray-800 cursor-pointer"
          >
            <input
              v-model="item.done"
              type="checkbox"
              class="mt-0.5 rounded border-gray-300 text-primary focus:ring-primary"
              @change="scheduleSave"
            >
            <span><span class="font-medium">{{ item.group }}</span> — {{ item.label }}</span>
          </label>
        </div>
        <div class="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
          <h2 class="text-sm font-semibold text-gray-900">Scene → Shot board</h2>
          <div v-for="scene in adapt.scenes" :key="`prod-${scene.id}`" class="space-y-2">
            <p class="text-sm font-medium text-gray-900">
              {{ scene.sceneNumber }}. {{ scene.title }}
              <span :class="['ml-2 inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase', statusClass(scene.status)]">{{ scene.status }}</span>
            </p>
            <div class="flex flex-wrap gap-2 pl-2">
              <div
                v-for="shot in shotsForScene(scene.id)"
                :key="shot.id"
                class="rounded-lg border border-gray-200 px-3 py-2 text-xs bg-gray-50"
              >
                <span class="font-medium text-gray-900">{{ shot.shotNumber }}. {{ shot.title || shot.shotType }}</span>
                <span :class="['ml-1.5 inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase', statusClass(shot.status)]">{{ shot.status }}</span>
              </div>
              <p v-if="!shotsForScene(scene.id).length" class="text-xs text-gray-500">No shots</p>
            </div>
          </div>
        </div>
        <div class="flex flex-wrap gap-4 text-sm">
          <NuxtLink :to="`/projects/${projectId}/storyboard`" class="text-primary font-medium hover:underline">Open Storyboard →</NuxtLink>
          <NuxtLink :to="`/projects/${projectId}/characters`" class="text-primary font-medium hover:underline">Characters →</NuxtLink>
        </div>
      </section>
    </template>

    <div
      v-if="generating"
      class="fixed inset-0 z-40 flex items-center justify-center bg-white/70 backdrop-blur-[1px]"
      aria-live="polite"
      aria-busy="true"
    >
      <div class="rounded-xl border border-gray-200 bg-white shadow-sm px-6 py-8 max-w-sm w-full mx-4">
        <FilmReelLoader size="md" :label="jobMessage || 'Generating…'" sub-label="Keep this tab open while Adapt to Film works." />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ADAPT_ASPECT_RATIOS,
  ADAPT_FIDELITY_OPTIONS,
  ADAPT_NARRATIVE_APPROACHES,
  ADAPT_SOURCE_TYPES,
  ADAPT_STAGE_LABELS,
  ADAPT_STAGES,
  ADAPT_TARGET_LENGTHS,
  ADAPT_TYPES,
  ADAPT_VISUAL_STYLE_PRESETS,
  computeProductionSummary,
  countWords,
  createEmptyAdaptState,
  defaultProductionChecklist,
  durationDeltaLabel,
  sumSceneDurationSeconds,
  targetRuntimeSeconds,
  validateAdaptSourceText
} from '~/lib/adapt-to-film'
import { formatApiFetchError } from '~/lib/format-api-fetch-error'
import type {
  AdaptJobKind,
  AdaptProductionSummary,
  AdaptScene,
  AdaptSceneStatus,
  AdaptShotStatus,
  AdaptSourceFidelityClass,
  AdaptStage,
  AdaptToFilmState,
  AdaptTreatmentVersion
} from '~/types/adapt-to-film'

definePageMeta({ ssr: false })

const fieldClass = 'w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary'
const labelClass = 'block text-xs font-medium text-gray-600 mb-1'
const btnPrimary = 'px-4 py-2 rounded-lg bg-primary text-gray-950 text-sm font-semibold hover:bg-primary/90 disabled:opacity-45 disabled:cursor-not-allowed'
const btnSecondary = 'px-4 py-2 rounded-lg bg-gray-200 text-gray-900 text-sm font-medium hover:bg-gray-300 disabled:opacity-45 disabled:cursor-not-allowed'
const btnTiny = 'px-2.5 py-1 rounded-md bg-white border border-gray-200 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-45'

const route = useRoute()
const { getAuthToken } = useAuth()
const toast = useToast()

const projectId = computed(() => {
  const p = route.params.projectId
  return typeof p === 'string' ? p : Array.isArray(p) ? p[0] ?? '' : ''
})

const adapt = ref<AdaptToFilmState | null>(null)
const summary = ref<AdaptProductionSummary | null>(null)
const saveStatus = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
const loadError = ref('')
const generating = ref(false)
const jobMessage = ref('')
const expanded = reactive<Record<string, boolean>>({})
const workingSourceEl = ref<HTMLTextAreaElement | null>(null)

let saveTimer: ReturnType<typeof setTimeout> | null = null
let suppressSave = false

const SCENE_FIDELITY: AdaptSourceFidelityClass[] = [
  'directly_sourced', 'lightly_adapted', 'ai_created_transition', 'dramatic_interpretation'
]
const SCENE_STATUSES: AdaptSceneStatus[] = ['draft', 'needs_review', 'approved', 'locked']
const SHOT_STATUSES: AdaptShotStatus[] = [
  'planned', 'prompt_ready', 'image_ready', 'video_ready', 'audio_ready', 'needs_revision', 'approved', 'locked'
]

type TreatmentStringKey =
  | 'proposedTitle' | 'logline' | 'shortSynopsis' | 'fullTreatment'
  | 'tone' | 'genre' | 'visualDirection' | 'narrativeStructure' | 'adaptationNotes'

const treatmentFields: Array<{ key: TreatmentStringKey; label: string; rows: number; regen?: boolean }> = [
  { key: 'proposedTitle', label: 'Proposed title', rows: 1 },
  { key: 'logline', label: 'Logline', rows: 2, regen: true },
  { key: 'shortSynopsis', label: 'Short synopsis', rows: 3 },
  { key: 'fullTreatment', label: 'Full treatment', rows: 10, regen: true },
  { key: 'tone', label: 'Tone', rows: 1 },
  { key: 'genre', label: 'Genre', rows: 1 },
  { key: 'visualDirection', label: 'Visual direction', rows: 3 },
  { key: 'narrativeStructure', label: 'Narrative structure', rows: 3 },
  { key: 'adaptationNotes', label: 'Adaptation notes', rows: 3 }
]

const showOriginalSource = computed(() => {
  if (!adapt.value) return false
  return !!adapt.value.originalSourceText.trim() &&
    adapt.value.originalSourceText !== adapt.value.workingSourceText
})

const activeTreatment = computed((): AdaptTreatmentVersion | null => {
  if (!adapt.value?.treatments?.length) return null
  const approved = adapt.value.treatments.find(t => t.id === adapt.value?.approvedTreatmentId)
  return approved || adapt.value.treatments[adapt.value.treatments.length - 1] || null
})

const sceneDurationWarning = computed(() => {
  if (!adapt.value) return null
  return durationDeltaLabel(
    sumSceneDurationSeconds(adapt.value.scenes),
    targetRuntimeSeconds(adapt.value.settings)
  ).warning
})

const prodSummary = computed(() => summary.value || (adapt.value ? computeProductionSummary(adapt.value) : null))

const productionCards = computed(() => {
  const s = prodSummary.value
  if (!s) return []
  return [
    { label: 'Scenes', value: `${s.approvedScenes}/${s.totalScenes}` },
    { label: 'Shots', value: `${s.approvedShots}/${s.totalShots}` },
    { label: 'Runtime', value: formatSeconds(s.estimatedRuntimeSeconds) },
    { label: 'Need images', value: String(s.shotsNeedingImages) }
  ]
})

function authHeaders (): Record<string, string> {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function formatSeconds (sec: number): string {
  const n = Math.max(0, Math.round(Number(sec) || 0))
  const m = Math.floor(n / 60)
  const s = n % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function statusClass (status: string): string {
  if (status === 'approved' || status === 'locked') return 'bg-emerald-50 text-emerald-800 border border-emerald-200'
  if (status === 'needs_review' || status === 'needs_revision') return 'bg-amber-50 text-amber-800 border border-amber-200'
  return 'bg-gray-100 text-gray-600 border border-gray-200'
}

function toggleExpand (key: string) {
  expanded[key] = !expanded[key]
}

function shotsForScene (sceneId: string) {
  return (adapt.value?.shots || []).filter(s => s.sceneId === sceneId)
}

function onTreatmentField (key: TreatmentStringKey, ev: Event) {
  if (!activeTreatment.value) return
  const value = (ev.target as HTMLTextAreaElement).value
  activeTreatment.value.content[key] = value
  scheduleSave()
}

function scheduleSave () {
  if (suppressSave || !adapt.value) return
  saveStatus.value = 'saving'
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => { void saveNow() }, 700)
}

async function saveNow () {
  if (!adapt.value || !projectId.value) return
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  saveStatus.value = 'saving'
  try {
    const res = await $fetch<{ adapt: AdaptToFilmState; summary: AdaptProductionSummary }>(
      `/api/projects/${projectId.value}/adapt`,
      { method: 'PATCH', headers: authHeaders(), body: { adapt: adapt.value } }
    )
    suppressSave = true
    adapt.value = res.adapt
    summary.value = res.summary
    suppressSave = false
    saveStatus.value = 'saved'
  } catch (e: unknown) {
    saveStatus.value = 'error'
    toast.showToast(formatApiFetchError(e, 'Could not save'), 'error')
  }
}

async function loadAdapt () {
  loadError.value = ''
  if (!projectId.value) return
  try {
    const res = await $fetch<{ adapt: AdaptToFilmState; summary: AdaptProductionSummary }>(
      `/api/projects/${projectId.value}/adapt`,
      { headers: authHeaders() }
    )
    suppressSave = true
    adapt.value = res.adapt
    summary.value = res.summary
    suppressSave = false
  } catch (e: unknown) {
    loadError.value = formatApiFetchError(e, 'Could not load Adapt to Film state')
    adapt.value = createEmptyAdaptState()
  }
}

async function goToStage (stage: AdaptStage) {
  if (!adapt.value || adapt.value.stage === stage) return
  await setStage(stage)
}

async function setStage (stage: AdaptStage) {
  if (!adapt.value) return
  adapt.value.stage = stage
  if (stage === 'production' && !adapt.value.checklist.length) {
    adapt.value.checklist = defaultProductionChecklist(adapt.value)
  }
  await saveNow()
}

async function continueFromSource () {
  if (!adapt.value) return
  const err = validateAdaptSourceText(adapt.value.workingSourceText)
  if (err) { toast.showToast(err, 'error'); return }
  await setStage('adaptation')
}

async function approveTreatmentAndContinue () {
  if (!adapt.value || !activeTreatment.value) return
  activeTreatment.value.approved = true
  adapt.value.approvedTreatmentId = activeTreatment.value.id
  await setStage('scenes')
}

function approveScene (scene: AdaptScene) {
  scene.status = 'approved'
  scheduleSave()
}

function addScene () {
  if (!adapt.value) return
  const n = adapt.value.scenes.length + 1
  adapt.value.scenes.push({
    id: `scn_local_${Date.now()}`,
    sceneNumber: n,
    title: `Scene ${n}`,
    purpose: '',
    sourceRefs: [],
    location: '',
    timeOfDay: '',
    historicalPeriod: '',
    characters: [],
    summary: '',
    visualDescription: '',
    narration: '',
    dialogue: '',
    estimatedDurationSeconds: 30,
    emotionalTone: '',
    transitionIn: '',
    transitionOut: '',
    requiredAssets: [],
    historicalNotes: '',
    continuityNotes: '',
    sourceFidelity: 'lightly_adapted',
    status: 'draft',
    locked: false
  })
  scheduleSave()
}

function deleteScene (idx: number) {
  if (!adapt.value) return
  const [removed] = adapt.value.scenes.splice(idx, 1)
  if (removed) adapt.value.shots = adapt.value.shots.filter(s => s.sceneId !== removed.id)
  adapt.value.scenes.forEach((s, i) => { s.sceneNumber = i + 1 })
  scheduleSave()
}

function duplicateScene (idx: number) {
  if (!adapt.value) return
  const src = adapt.value.scenes[idx]
  if (!src) return
  const copy: AdaptScene = {
    ...JSON.parse(JSON.stringify(src)),
    id: `scn_local_${Date.now()}`,
    title: `${src.title} (copy)`,
    status: 'draft',
    locked: false,
    creativeSceneId: undefined
  }
  adapt.value.scenes.splice(idx + 1, 0, copy)
  adapt.value.scenes.forEach((s, i) => { s.sceneNumber = i + 1 })
  scheduleSave()
}

function viewInSource (scene: AdaptScene) {
  if (!adapt.value) return
  adapt.value.stage = 'source'
  nextTick(() => {
    workingSourceEl.value?.focus()
    const ref = scene.sourceRefs?.[0]
    if (ref && typeof ref.startChar === 'number' && typeof ref.endChar === 'number' && workingSourceEl.value) {
      workingSourceEl.value.setSelectionRange(ref.startChar, ref.endChar)
      workingSourceEl.value.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })
}

async function pollJob (jobId: string) {
  const id = projectId.value
  for (let i = 0; i < 180; i++) {
    await new Promise(r => setTimeout(r, 1500))
    const job = await $fetch<{
      status: string
      message?: string
      error?: string
      result?: { adapt: AdaptToFilmState; summary: AdaptProductionSummary }
    }>(`/api/projects/${id}/adapt/jobs/${jobId}`, { headers: authHeaders() })
    jobMessage.value = job.message || 'Generating…'
    if (job.status === 'completed' && job.result) {
      suppressSave = true
      adapt.value = job.result.adapt
      summary.value = job.result.summary
      suppressSave = false
      return
    }
    if (job.status === 'failed' || job.status === 'cancelled') {
      throw new Error(job.error || job.message || 'Generation failed')
    }
  }
  throw new Error('Generation timed out. Refresh and check status.')
}

async function runGenerate (body: {
  kind: AdaptJobKind
  sectionKey?: string
  sceneId?: string
  shotId?: string
  promptWhich?: 'image' | 'video'
  versionMode?: 'replace' | 'new'
  includeDraftScenes?: boolean
}) {
  if (!projectId.value) return
  if (adapt.value) await saveNow()
  generating.value = true
  jobMessage.value = 'Starting…'
  try {
    const res = await $fetch<{ jobId: string }>(`/api/projects/${projectId.value}/adapt/generate`, {
      method: 'POST',
      headers: authHeaders(),
      body
    })
    await pollJob(res.jobId)
    toast.showToast('Generation complete.', 'success')
  } catch (e: unknown) {
    toast.showToast(formatApiFetchError(e, 'Generation failed'), 'error')
  } finally {
    generating.value = false
    jobMessage.value = ''
  }
}

onMounted(() => { void loadAdapt() })
watch(projectId, () => { void loadAdapt() })
</script>
