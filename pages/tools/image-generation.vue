<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 pb-28 lg:pb-10">
    <header class="mb-8">
      <h1 class="font-display text-3xl sm:text-4xl text-ivory tracking-wide">
        Generate Images
      </h1>
      <p class="mt-2 text-gray-600 text-sm sm:text-base max-w-2xl">
        Create characters, locations, props, storyboards, concept art, and other visual assets for your film.
      </p>
    </header>

    <div
      v-if="storyboardContextActive"
      class="mb-6 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
    >
      <div class="text-sm text-gray-800">
        <p class="font-semibold text-gray-900">Storyboard frame</p>
        <p class="text-gray-600 mt-0.5">
          Result will attach as the
          <span class="font-medium">{{ frameRole === 'end' ? 'end' : 'start' }}</span>
          frame for this shot.
        </p>
      </div>
      <NuxtLink
        v-if="returnTo"
        :to="returnTo"
        class="text-sm font-medium text-primary hover:underline"
      >
        ← Back to Storyboard
      </NuxtLink>
    </div>

    <ClientOnly>
      <div
        v-if="projects.length"
        class="mb-6 flex flex-wrap items-center gap-3"
      >
        <label for="img-gen-project" class="text-sm font-medium text-gray-700">Project</label>
        <select
          id="img-gen-project"
          v-model="projectId"
          class="min-w-[12rem] rounded-lg border border-gray-300 bg-studio-slate px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="">No project</option>
          <option v-for="p in projects" :key="p.id" :value="p.id">
            {{ p.name }}
          </option>
        </select>
        <label for="img-gen-category" class="text-sm font-medium text-gray-700 sr-only sm:not-sr-only">Asset type</label>
        <select
          id="img-gen-category"
          v-model="category"
          class="rounded-lg border border-gray-300 bg-studio-slate px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/40"
          aria-label="Asset type"
        >
          <option v-for="c in categoryOptions" :key="c.id" :value="c.id">
            {{ c.label }}
          </option>
        </select>
      </div>
    </ClientOnly>

    <p
      v-if="modelsNotice"
      class="mb-6 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700"
    >
      {{ modelsNotice }}
    </p>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10">
      <!-- Controls -->
      <section class="space-y-6" aria-label="Generation controls">
        <div>
          <div class="flex items-baseline justify-between gap-3 mb-2">
            <label for="img-gen-prompt" class="text-sm font-semibold text-gray-900">
              Describe the image
            </label>
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-500 tabular-nums">{{ prompt.length }}</span>
              <PromptEnhanceButton
                v-model="prompt"
                context="image"
                :project-id="projectId || undefined"
                :disabled="generating"
              />
            </div>
          </div>
          <textarea
            id="img-gen-prompt"
            v-model="prompt"
            rows="7"
            class="w-full rounded-xl border border-gray-300 bg-studio-slate px-4 py-3 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y min-h-[10rem]"
            placeholder="Cinematic wide shot of an abandoned roadside motel at night, flickering neon VACANCY sign, rain-soaked parking lot, 1970s horror film, dramatic practical lighting, 35mm film grain."
            @keydown="onPromptKeydown"
          />
        </div>

        <div>
          <label for="img-gen-model" class="block text-sm font-semibold text-gray-900 mb-2">
            Image Model
          </label>
          <div v-if="modelsPending" class="text-sm text-gray-600 animate-pulse">
            Loading models…
          </div>
          <template v-else>
            <input
              v-model="modelSearch"
              type="search"
              class="w-full mb-2 rounded-lg border border-gray-300 bg-studio-slate px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="Search models…"
              aria-label="Search image models"
            >
            <select
              id="img-gen-model"
              v-model="modelId"
              class="w-full rounded-lg border border-gray-300 bg-studio-slate px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option v-for="m in filteredModels" :key="m.id" :value="m.id">
                {{ m.name }}{{ m.priceLabel ? ` · ${m.priceLabel}` : '' }}
              </option>
            </select>
            <div v-if="selectedModel" class="mt-2 space-y-1.5">
              <p v-if="selectedModel.provider" class="text-xs text-gray-500">
                {{ selectedModel.provider }}
                <span v-if="selectedModel.priceLabel"> · {{ selectedModel.priceLabel }}</span>
              </p>
              <div v-if="selectedModel.badges?.length" class="flex flex-wrap gap-1.5">
                <span
                  v-for="b in selectedModel.badges"
                  :key="b"
                  :class="badgeClass(b)"
                >{{ b }}</span>
              </div>
              <p v-if="selectedModel.description" class="text-xs text-gray-600 line-clamp-2">
                {{ selectedModel.description }}
              </p>
            </div>
          </template>
        </div>

        <div>
          <p class="text-sm font-semibold text-gray-900 mb-2" id="aspect-label">Aspect Ratio</p>
          <div class="flex flex-wrap gap-2" role="group" aria-labelledby="aspect-label">
            <button
              v-for="preset in aspectPresets"
              :key="preset.value"
              type="button"
              class="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
              :class="aspectButtonClass(preset.value)"
              :disabled="!aspectEnabled(preset.value)"
              :aria-pressed="aspectRatio === preset.value"
              @click="aspectRatio = preset.value"
            >
              {{ preset.label }}
            </button>
          </div>
        </div>

        <div v-if="selectedModel?.resolutions?.length">
          <label for="img-gen-resolution" class="block text-sm font-semibold text-gray-900 mb-2">
            Resolution
          </label>
          <select
            id="img-gen-resolution"
            v-model="resolution"
            class="w-full rounded-lg border border-gray-300 bg-studio-slate px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option v-for="r in selectedModel.resolutions" :key="r" :value="r">
              {{ r }}
            </option>
          </select>
        </div>

        <div v-if="(selectedModel?.maxImages || 1) > 1">
          <p class="text-sm font-semibold text-gray-900 mb-2" id="count-label">Images</p>
          <div class="flex flex-wrap gap-2" role="group" aria-labelledby="count-label">
            <button
              v-for="n in imageCountOptions"
              :key="n"
              type="button"
              class="w-10 h-10 rounded-lg text-sm font-medium border transition-colors"
              :class="imageCount === n
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-gray-300 text-gray-700 hover:border-primary/40'"
              :aria-pressed="imageCount === n"
              @click="imageCount = n"
            >
              {{ n }}
            </button>
          </div>
        </div>

        <!-- Film controls -->
        <div class="rounded-xl border border-gray-200 bg-studio-slate p-4 space-y-3">
          <p class="text-sm font-semibold text-gray-900">Film Controls</p>
          <p class="text-xs text-gray-500">Optional — appended to your prompt when generating.</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label class="block text-xs font-medium text-gray-600">
              Shot size
              <select
                v-model="filmControls.shotSize"
                class="mt-1 w-full rounded-lg border border-gray-300 bg-studio-charcoal/40 px-2 py-1.5 text-sm text-gray-900"
              >
                <option :value="null">—</option>
                <option v-for="s in shotSizes" :key="s" :value="s">{{ s }}</option>
              </select>
            </label>
            <label class="block text-xs font-medium text-gray-600">
              Camera angle
              <select
                v-model="filmControls.cameraAngle"
                class="mt-1 w-full rounded-lg border border-gray-300 bg-studio-charcoal/40 px-2 py-1.5 text-sm text-gray-900"
              >
                <option :value="null">—</option>
                <option v-for="s in cameraAngles" :key="s" :value="s">{{ s }}</option>
              </select>
            </label>
            <label class="block text-xs font-medium text-gray-600">
              Lens
              <select
                v-model="filmControls.lens"
                class="mt-1 w-full rounded-lg border border-gray-300 bg-studio-charcoal/40 px-2 py-1.5 text-sm text-gray-900"
              >
                <option :value="null">—</option>
                <option v-for="s in lenses" :key="s" :value="s">{{ s }}</option>
              </select>
            </label>
            <label class="block text-xs font-medium text-gray-600">
              Lighting
              <select
                v-model="filmControls.lighting"
                class="mt-1 w-full rounded-lg border border-gray-300 bg-studio-charcoal/40 px-2 py-1.5 text-sm text-gray-900"
              >
                <option :value="null">—</option>
                <option v-for="s in lightingOptions" :key="s" :value="s">{{ s }}</option>
              </select>
            </label>
            <label class="block text-xs font-medium text-gray-600 sm:col-span-2">
              Style
              <select
                v-model="filmControls.style"
                class="mt-1 w-full rounded-lg border border-gray-300 bg-studio-charcoal/40 px-2 py-1.5 text-sm text-gray-900"
              >
                <option :value="null">—</option>
                <option v-for="s in styleOptions" :key="s" :value="s">{{ s }}</option>
              </select>
            </label>
          </div>
        </div>

        <!-- References -->
        <div class="rounded-xl border border-gray-200 bg-studio-slate p-4 space-y-3">
          <p class="text-sm font-semibold text-gray-900">Reference Images</p>
          <template v-if="selectedModel?.supportsReferences">
            <div
              class="rounded-lg border border-dashed border-gray-400 bg-gray-50/50 px-4 py-6 text-center"
              @dragover.prevent
              @drop.prevent="onDropRefs"
            >
              <p class="text-sm text-gray-600 mb-3">Drag & drop or choose files</p>
              <label class="inline-flex cursor-pointer px-4 py-2 rounded-lg border border-gray-300 bg-studio-slate text-sm font-medium text-gray-800 hover:border-primary/50">
                Add reference
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  class="sr-only"
                  @change="onPickRefs"
                >
              </label>
            </div>
            <ul v-if="referencePreviewUrls.length" class="flex flex-wrap gap-2">
              <li
                v-for="(url, i) in referencePreviewUrls"
                :key="url"
                class="relative w-16 h-16 rounded-md overflow-hidden border border-gray-300"
              >
                <img :src="url" alt="" class="w-full h-full object-cover">
                <button
                  type="button"
                  class="absolute top-0.5 right-0.5 w-5 h-5 rounded bg-black/70 text-white text-xs leading-none"
                  aria-label="Remove reference"
                  @click="removeReference(i)"
                >
                  ×
                </button>
              </li>
            </ul>
          </template>
          <p v-else class="text-sm text-gray-500">
            This model does not support reference images.
          </p>
        </div>

        <!-- Advanced -->
        <div class="rounded-xl border border-gray-200 bg-studio-slate overflow-hidden">
          <button
            type="button"
            class="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50/50"
            :aria-expanded="advancedOpen"
            @click="advancedOpen = !advancedOpen"
          >
            Advanced
            <span class="text-gray-500" aria-hidden="true">{{ advancedOpen ? '−' : '+' }}</span>
          </button>
          <div v-if="advancedOpen" class="px-4 pb-4 space-y-3 border-t border-gray-200 pt-3">
            <p class="text-xs text-gray-500">
              Only parameters supported by the selected model are sent.
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label v-if="supportsParam('seed')" class="block text-xs font-medium text-gray-600">
                Seed
                <input
                  v-model.number="advanced.seed"
                  type="number"
                  class="mt-1 w-full rounded-lg border border-gray-300 bg-studio-charcoal/40 px-2 py-1.5 text-sm"
                >
              </label>
              <label v-if="supportsParam('guidance') || supportsParam('guidance_scale')" class="block text-xs font-medium text-gray-600">
                Guidance
                <input
                  v-model.number="advanced.guidance"
                  type="number"
                  step="0.1"
                  class="mt-1 w-full rounded-lg border border-gray-300 bg-studio-charcoal/40 px-2 py-1.5 text-sm"
                >
              </label>
              <label v-if="supportsParam('strength')" class="block text-xs font-medium text-gray-600">
                Strength
                <input
                  v-model.number="advanced.strength"
                  type="number"
                  step="0.05"
                  class="mt-1 w-full rounded-lg border border-gray-300 bg-studio-charcoal/40 px-2 py-1.5 text-sm"
                >
              </label>
              <label v-if="supportsParam('style')" class="block text-xs font-medium text-gray-600">
                Style
                <input
                  v-model="advanced.style"
                  type="text"
                  class="mt-1 w-full rounded-lg border border-gray-300 bg-studio-charcoal/40 px-2 py-1.5 text-sm"
                >
              </label>
              <label v-if="supportsParam('negative_prompt') || supportsParam('negativePrompt')" class="block text-xs font-medium text-gray-600 sm:col-span-2">
                Negative prompt
                <input
                  v-model="advanced.negativePrompt"
                  type="text"
                  class="mt-1 w-full rounded-lg border border-gray-300 bg-studio-charcoal/40 px-2 py-1.5 text-sm"
                >
              </label>
              <label v-if="supportsParam('background')" class="block text-xs font-medium text-gray-600">
                Background
                <input
                  v-model="advanced.background"
                  type="text"
                  class="mt-1 w-full rounded-lg border border-gray-300 bg-studio-charcoal/40 px-2 py-1.5 text-sm"
                >
              </label>
              <label v-if="supportsParam('output_format') || supportsParam('outputFormat')" class="block text-xs font-medium text-gray-600">
                Output format
                <input
                  v-model="advanced.outputFormat"
                  type="text"
                  class="mt-1 w-full rounded-lg border border-gray-300 bg-studio-charcoal/40 px-2 py-1.5 text-sm"
                >
              </label>
            </div>
            <p
              v-if="!anyAdvancedSupported"
              class="text-xs text-gray-500"
            >
              This model does not expose additional advanced parameters.
            </p>
          </div>
        </div>

        <p v-if="formError" class="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2" role="alert">
          {{ formError }}
        </p>

        <button
          type="button"
          class="hidden lg:inline-flex w-full items-center justify-center px-5 py-3 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg text-sm transition-colors disabled:opacity-50"
          :disabled="generating || modelsPending || !prompt.trim()"
          @click="generate"
        >
          {{ generating ? 'Creating…' : 'Generate Image' }}
        </button>
        <p class="hidden lg:block text-xs text-gray-500 text-center">
          ⌘/Ctrl + Enter
        </p>
      </section>

      <!-- Results -->
      <section class="space-y-6" aria-label="Generation results">
        <div
          class="rounded-xl border border-gray-200 bg-studio-slate overflow-hidden"
          :style="previewFrameStyle"
        >
          <div
            v-if="generating"
            class="flex flex-col items-center justify-center gap-4 px-6 py-16 min-h-[16rem]"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <div
              class="w-full max-w-md rounded-lg bg-gray-100/80 animate-pulse border border-gray-200"
              :style="{ aspectRatio: skeletonAspect }"
              aria-hidden="true"
            />
            <FilmReelLoader
              size="md"
              label="Creating your image…"
              :sub-label="selectedModel?.name || modelId"
            />
          </div>

          <div
            v-else-if="latest?.imageUrls?.length"
            class="p-4 sm:p-5 space-y-4"
          >
            <div
              v-for="(url, i) in latest.imageUrls"
              :key="url"
              class="rounded-lg overflow-hidden border border-gray-200 bg-black/20"
            >
              <button
                type="button"
                class="block w-full focus:outline-none focus:ring-2 focus:ring-primary/50"
                :aria-label="`Open image ${i + 1} details`"
                @click="detail = latest"
              >
                <img
                  :src="mediaSrc(url)"
                  :alt="latest.prompt?.slice(0, 120) || 'Generated image'"
                  class="w-full h-auto object-contain max-h-[70vh] mx-auto"
                >
              </button>
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-800 hover:border-primary/40"
                @click="downloadImage(latest.imageUrls[0]!, 0)"
              >
                Download
              </button>
              <button
                type="button"
                class="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-800 hover:border-primary/40"
                @click="generate"
              >
                Generate Again
              </button>
              <button
                type="button"
                class="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-800 hover:border-primary/40"
                @click="createVariation(latest)"
              >
                Create Variation
              </button>
              <button
                type="button"
                class="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-800 hover:border-primary/40"
                @click="reusePrompt(latest)"
              >
                Reuse Prompt
              </button>
              <NuxtLink
                v-if="returnTo && lastAttachedStoryboardAssetId"
                :to="returnTo"
                class="px-3 py-2 rounded-lg border border-primary/40 text-sm font-medium text-primary hover:bg-primary/5"
              >
                Open Storyboard
              </NuxtLink>
              <button
                v-if="canUseAsVideoReference"
                type="button"
                class="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-800 hover:border-primary/40"
                @click="useAsVideoReference"
              >
                Use as Video Start Frame
              </button>
              <NuxtLink
                v-else-if="latest.projectId"
                :to="`/tools/video-generation?projectId=${encodeURIComponent(latest.projectId)}`"
                class="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-800 hover:border-primary/40"
              >
                Open Video Generation
              </NuxtLink>
              <button
                type="button"
                class="px-3 py-2 rounded-lg border border-red-300 text-sm font-medium text-red-700 hover:bg-red-50"
                @click="deleteGeneration(latest)"
              >
                Delete
              </button>
            </div>
            <p
              v-if="lastAttachedStoryboardAssetId"
              class="text-xs text-gray-500"
            >
              Saved as storyboard panel asset
              <span class="font-mono">{{ lastAttachedStoryboardAssetId }}</span>.
            </p>
          </div>

          <div
            v-else
            class="flex flex-col items-center justify-center px-6 py-20 text-center min-h-[16rem]"
          >
            <p class="text-sm text-gray-500">Generated images will appear here.</p>
          </div>
        </div>
      </section>
    </div>

    <!-- History -->
    <section class="mt-14" aria-labelledby="recent-gens-heading">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 id="recent-gens-heading" class="text-lg font-semibold text-gray-900">
          Recent Generations
        </h2>
        <div class="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter generations">
          <button
            v-for="f in historyFilters"
            :key="f.id"
            type="button"
            role="tab"
            class="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
            :class="historyFilter === f.id
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-gray-300 text-gray-600 hover:border-primary/40'"
            :aria-selected="historyFilter === f.id"
            @click="historyFilter = f.id; loadHistory()"
          >
            {{ f.label }}
          </button>
        </div>
      </div>

      <div v-if="historyPending" class="text-sm text-gray-600 animate-pulse">
        Loading history…
      </div>
      <p v-else-if="!history.length" class="text-sm text-gray-500">
        No generations yet.
      </p>
      <ul v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
        <li v-for="item in history" :key="item.id">
          <button
            type="button"
            class="group w-full text-left rounded-xl border border-gray-200 bg-studio-slate overflow-hidden hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/40"
            @click="detail = item"
          >
            <div class="aspect-video bg-gray-100 relative">
              <img
                v-if="item.imageUrls?.[0] && item.status === 'complete'"
                :src="mediaSrc(item.imageUrls[0])"
                alt=""
                class="w-full h-full object-cover"
              >
              <div
                v-else
                class="absolute inset-0 flex items-center justify-center text-xs text-gray-500 px-2 text-center"
              >
                {{ item.status === 'failed' ? 'Failed' : 'No image' }}
              </div>
            </div>
            <div class="p-2.5 space-y-0.5">
              <p class="text-xs font-medium text-gray-800 truncate">{{ shortModel(item.model) }}</p>
              <p class="text-[11px] text-gray-500">
                {{ item.aspectRatio || '—' }} · {{ formatDate(item.created) }}
              </p>
            </div>
          </button>
        </li>
      </ul>
    </section>

    <!-- Detail modal -->
    <Teleport to="body">
      <div
        v-if="detail"
        class="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-label="Image generation details"
      >
        <button
          type="button"
          class="absolute inset-0 bg-black/70"
          aria-label="Close"
          @click="detail = null"
        />
        <div class="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-gray-200 bg-studio-slate shadow-xl">
          <div class="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 bg-studio-slate">
            <h3 class="text-sm font-semibold text-gray-900">Generation details</h3>
            <button
              type="button"
              class="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
              @click="detail = null"
            >
              Close
            </button>
          </div>
          <div class="p-4 sm:p-6 space-y-4">
            <div v-if="detail.imageUrls?.[0]" class="rounded-lg overflow-hidden border border-gray-200">
              <img
                :src="mediaSrc(detail.imageUrls[0])"
                :alt="detail.prompt?.slice(0, 120) || 'Generated image'"
                class="w-full h-auto"
              >
            </div>
            <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div class="sm:col-span-2">
                <dt class="text-xs font-medium text-gray-500">Prompt</dt>
                <dd class="mt-0.5 text-gray-900 whitespace-pre-wrap">{{ detail.prompt }}</dd>
              </div>
              <div class="sm:col-span-2">
                <dt class="text-xs font-medium text-gray-500">Final prompt</dt>
                <dd class="mt-0.5 text-gray-800 whitespace-pre-wrap">{{ detail.finalPrompt }}</dd>
              </div>
              <div>
                <dt class="text-xs font-medium text-gray-500">Model</dt>
                <dd class="mt-0.5 text-gray-900">{{ detail.model }}</dd>
              </div>
              <div>
                <dt class="text-xs font-medium text-gray-500">Provider</dt>
                <dd class="mt-0.5 text-gray-900">{{ detail.provider || '—' }}</dd>
              </div>
              <div>
                <dt class="text-xs font-medium text-gray-500">Aspect ratio</dt>
                <dd class="mt-0.5 text-gray-900">{{ detail.aspectRatio || '—' }}</dd>
              </div>
              <div>
                <dt class="text-xs font-medium text-gray-500">Resolution</dt>
                <dd class="mt-0.5 text-gray-900">{{ detail.resolution || '—' }}</dd>
              </div>
              <div>
                <dt class="text-xs font-medium text-gray-500">Date</dt>
                <dd class="mt-0.5 text-gray-900">{{ formatDate(detail.created) }}</dd>
              </div>
              <div>
                <dt class="text-xs font-medium text-gray-500">Cost</dt>
                <dd class="mt-0.5 text-gray-900">
                  {{ detail.cost != null ? `$${Number(detail.cost).toFixed(4)} ${detail.currency || 'USD'}` : '—' }}
                </dd>
              </div>
              <div>
                <dt class="text-xs font-medium text-gray-500">Status</dt>
                <dd class="mt-0.5 text-gray-900">{{ detail.status }}</dd>
              </div>
              <div>
                <dt class="text-xs font-medium text-gray-500">Project</dt>
                <dd class="mt-0.5 text-gray-900">{{ detail.projectId || '—' }}</dd>
              </div>
            </dl>
            <div v-if="detail.errorMessage" class="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {{ detail.errorMessage }}
            </div>
            <div class="flex flex-wrap gap-2 pt-2">
              <button
                v-if="detail.imageUrls?.[0]"
                type="button"
                class="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium"
                @click="downloadImage(detail.imageUrls[0], 0)"
              >
                Download
              </button>
              <button
                type="button"
                class="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium"
                @click="reusePrompt(detail)"
              >
                Reuse Prompt
              </button>
              <button
                type="button"
                class="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium"
                @click="createVariation(detail)"
              >
                Create Variation
              </button>
              <button
                type="button"
                class="px-3 py-2 rounded-lg border border-red-300 text-sm font-medium text-red-700"
                @click="deleteGeneration(detail)"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Mobile sticky CTA -->
    <div class="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-gray-200 bg-studio-charcoal/95 backdrop-blur px-4 py-3 safe-pb">
      <button
        type="button"
        class="w-full inline-flex items-center justify-center px-5 py-3 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg text-sm disabled:opacity-50"
        :disabled="generating || modelsPending || !prompt.trim()"
        @click="generate"
      >
        {{ generating ? 'Creating…' : 'Generate Image' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  FILM_CONTROL_CAMERA_ANGLES,
  FILM_CONTROL_LENSES,
  FILM_CONTROL_LIGHTING,
  FILM_CONTROL_SHOT_SIZES,
  FILM_CONTROL_STYLES,
  IMAGE_ASPECT_RATIO_PRESETS,
  IMAGE_GENERATION_CATEGORIES
} from '~/lib/image-generation-defaults'
import {
  parseImageGenerationQuery,
  takeImageGenerationPrefill
} from '~/lib/image-generation-prefill'
import { stashVideoGenerationPanelPrefill } from '~/lib/video-generation-prefill'
import { projectAssetMediaPath } from '~/lib/project-asset-playback-url'
import type { ImageGenerationCategory } from '~/types/image-generation'

const {
  prompt,
  modelId,
  aspectRatio,
  resolution,
  imageCount,
  category,
  filmControls,
  advancedOpen,
  advanced,
  referencePreviewUrls,
  projectId,
  sceneId,
  shotId,
  frameRole,
  returnTo,
  lastAttachedStoryboardAssetId,
  storyboardContextActive,
  generating,
  formError,
  latest,
  history,
  historyPending,
  historyFilter,
  detail,
  models,
  modelsNotice,
  modelsPending,
  selectedModel,
  loadModels,
  loadHistory,
  generate,
  reusePrompt,
  createVariation,
  deleteGeneration,
  downloadImage,
  mediaSrc,
  addReferenceFiles,
  removeReference,
  applyPrefill,
  badgeClass
} = useImageGeneration()

const { projects, hydrate, loadServerProjects, isCloudProjectId } = useCreativeProject()
const { initAuth } = useAuth()
const route = useRoute()
const toast = useToast()

const modelSearch = ref('')
const shotSizes = FILM_CONTROL_SHOT_SIZES
const cameraAngles = FILM_CONTROL_CAMERA_ANGLES
const lenses = FILM_CONTROL_LENSES
const lightingOptions = FILM_CONTROL_LIGHTING
const styleOptions = FILM_CONTROL_STYLES
const aspectPresets = IMAGE_ASPECT_RATIO_PRESETS
const categoryOptions = IMAGE_GENERATION_CATEGORIES.filter((c) => c.id !== 'all') as Array<{
  id: ImageGenerationCategory
  label: string
}>
const historyFilters = IMAGE_GENERATION_CATEGORIES

const filteredModels = computed(() => {
  const q = modelSearch.value.trim().toLowerCase()
  if (!q) return models.value
  return models.value.filter(
    (m) =>
      m.name.toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q) ||
      (m.provider || '').toLowerCase().includes(q)
  )
})

const imageCountOptions = computed(() => {
  const max = selectedModel.value?.maxImages || 1
  return Array.from({ length: max }, (_, i) => i + 1)
})

const skeletonAspect = computed(() => {
  const ar = aspectRatio.value || '16:9'
  const [w, h] = ar.split(':').map(Number)
  if (w && h) return `${w} / ${h}`
  return '16 / 9'
})

const previewFrameStyle = computed(() => ({}))

const canUseAsVideoReference = computed(() => {
  const pid = latest.value?.projectId || projectId.value
  const assetId = lastAttachedStoryboardAssetId.value || latest.value?.assetIds?.[0]
  return Boolean(pid && assetId)
})

async function useAsVideoReference () {
  const pid = (latest.value?.projectId || projectId.value || '').trim()
  const assetId = (lastAttachedStoryboardAssetId.value || latest.value?.assetIds?.[0] || '').trim()
  if (!pid || !assetId) {
    toast.info('Save the image to a project first.')
    return
  }
  const mediaUrl = projectAssetMediaPath(pid, assetId)
  const motionPrompt =
    (latest.value?.prompt || prompt.value || ' ').trim() || ' '
  const q: Record<string, string> = { projectId: pid }
  if (sceneId.value.trim()) q.sceneId = sceneId.value.trim()
  if (shotId.value.trim()) q.shotId = shotId.value.trim()
  stashVideoGenerationPanelPrefill({
    prompt: motionPrompt,
    startFrameUrl: mediaUrl,
    projectId: pid,
    sceneId: sceneId.value.trim() || undefined,
    shotId: shotId.value.trim() || undefined,
    saveToProject: true,
    source: 'standalone_video_tool',
    aspectRatio: (aspectRatio.value === '9:16' || aspectRatio.value === '1:1'
      ? aspectRatio.value
      : '16:9') as '16:9' | '9:16' | '1:1'
  })
  toast.info('Start frame ready — opening Video Generation.')
  await navigateTo({
    path: '/tools/video-generation',
    query: q
  })
}

const anyAdvancedSupported = computed(() => {
  const keys = selectedModel.value?.supportedParameterKeys || []
  const lower = keys.map((k) => k.toLowerCase())
  return [
    'seed',
    'guidance',
    'guidance_scale',
    'strength',
    'style',
    'negative_prompt',
    'background',
    'output_format'
  ].some((k) => lower.includes(k))
})

function supportsParam (...names: string[]): boolean {
  const keys = (selectedModel.value?.supportedParameterKeys || []).map((k) => k.toLowerCase())
  return names.some((n) => keys.includes(n.toLowerCase()))
}

function aspectEnabled (value: string): boolean {
  const supported = selectedModel.value?.aspectRatios || []
  if (!supported.length) return true
  return supported.includes(value)
}

function aspectButtonClass (value: string): string {
  if (!aspectEnabled(value)) {
    return 'border-gray-200 text-gray-400 opacity-50 cursor-not-allowed'
  }
  return aspectRatio.value === value
    ? 'border-primary bg-primary/10 text-primary'
    : 'border-gray-300 text-gray-700 hover:border-primary/40'
}

function onPromptKeydown (e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault()
    if (!generating.value) void generate()
  }
}

function onPickRefs (e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.length) addReferenceFiles(input.files)
  input.value = ''
}

function onDropRefs (e: DragEvent) {
  if (e.dataTransfer?.files?.length) addReferenceFiles(e.dataTransfer.files)
}

function shortModel (id: string): string {
  const slash = id.lastIndexOf('/')
  return slash >= 0 ? id.slice(slash + 1) : id
}

function formatDate (iso: string): string {
  if (!iso) return '—'
  try {
    // Fixed locale/timeZone so SSR and client render identical strings.
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'UTC'
    })
  } catch {
    return iso
  }
}

watch(projectId, () => {
  void loadHistory()
})

onMounted(async () => {
  await initAuth()
  hydrate()
  await loadServerProjects().catch(() => {})

  const fromStash = takeImageGenerationPrefill()
  const fromQuery = parseImageGenerationQuery(route.query as Record<string, unknown>)
  applyPrefill({
    ...fromQuery,
    ...(fromStash || {}),
    // Query ids win for write-back if stash omitted them
    projectId: fromStash?.projectId || fromQuery.projectId,
    sceneId: fromStash?.sceneId || fromQuery.sceneId,
    shotId: fromStash?.shotId || fromQuery.shotId,
    frameRole: fromStash?.frameRole || fromQuery.frameRole,
    returnTo: fromStash?.returnTo || fromQuery.returnTo
  })

  const qProject = projectId.value
  if (qProject && isCloudProjectId(qProject)) {
    projectId.value = qProject
  }

  await loadModels()
  await loadHistory()
})

useHead({
  title: 'Generate Images'
})
</script>
