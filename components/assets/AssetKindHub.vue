<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
    <nav class="text-sm text-gray-500 mb-6">
      <NuxtLink to="/assets" class="hover:text-primary">Assets</NuxtLink>
      <span class="mx-2" aria-hidden="true">/</span>
      <span class="text-gray-900">{{ headline }}</span>
    </nav>

    <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">{{ headline }}</h1>
    <p class="text-gray-600 text-sm sm:text-base mb-6 max-w-2xl">
      {{ blurb }}
    </p>

    <div class="flex flex-wrap gap-2 mb-8">
      <NuxtLink
        v-for="a in actions"
        :key="a.to"
        :to="a.to"
        class="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        :class="a.primary
          ? 'bg-primary hover:bg-primary/90 text-gray-950'
          : 'border border-gray-300 text-gray-800 hover:bg-gray-50'"
      >
        {{ a.label }}
      </NuxtLink>
      <button
        v-if="isAuthenticated"
        type="button"
        class="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-800 hover:bg-gray-50 transition-colors"
        @click="openAdd = true"
      >
        Add {{ addButtonLabel }}
      </button>
    </div>

    <ClientOnly>
      <div v-if="!isAuthenticated" class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Sign in to see your {{ headline.toLowerCase() }} library and add entries.
      </div>

      <template v-else>
        <p v-if="loadError" class="text-sm text-red-700 mb-4">{{ loadError }}</p>
        <p v-else-if="loading" class="text-sm text-gray-600 mb-4">Loading…</p>

        <div
          v-else-if="characterFilterLabel"
          class="mb-4 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary"
        >
          Showing images for: <span class="font-semibold">{{ characterFilterLabel }}</span>
        </div>

        <template v-if="props.kind === 'video' && videoProjectGroups.length">
          <details
            v-for="g in videoProjectGroups"
            :key="g.key"
            :class="PROJECT_GROUP_CARD_CLASS"
          >
            <summary
              class="list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none px-4 py-3 bg-gray-50/90 flex flex-wrap items-center justify-between gap-2 hover:bg-gray-100/80 border-b border-transparent group-open:border-gray-200"
            >
              <div class="flex items-start gap-2 min-w-0 flex-1">
                <span
                  class="text-gray-400 text-xs shrink-0 mt-0.5 transition-transform group-open:rotate-90"
                  aria-hidden="true"
                >▶</span>
                <div class="min-w-0">
                  <h2 class="text-sm font-semibold text-gray-900 truncate">
                    {{ g.title }}
                  </h2>
                  <p v-if="g.subtitle" class="text-xs text-gray-500 mt-0.5">
                    {{ g.subtitle }}
                    <span class="text-gray-400"> · {{ g.items.length }} clip{{ g.items.length === 1 ? '' : 's' }}</span>
                  </p>
                  <p v-else class="text-xs text-gray-500 mt-0.5">
                    {{ g.items.length }} clip{{ g.items.length === 1 ? '' : 's' }}
                  </p>
                </div>
              </div>
              <NuxtLink
                v-if="g.projectId && PB_ID.test(g.projectId)"
                :to="`/projects/${g.projectId}/video`"
                class="text-xs font-medium text-primary hover:underline shrink-0"
                @click.stop
              >
                Open Video step →
              </NuxtLink>
            </summary>
            <ul class="divide-y divide-gray-200">
              <li
                v-for="a in g.items"
                :key="a.id"
                class="px-4 py-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
              >
                <div class="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-start gap-3">
                  <div
                    v-if="a.fileUrl"
                    class="w-full max-w-[min(100%,20rem)] sm:max-w-xs rounded-lg border border-gray-200 overflow-hidden bg-black shrink-0"
                  >
                    <video
                      :src="videoAssetPlaybackSrc(a)"
                      class="w-full aspect-video object-contain"
                      controls
                      playsinline
                      preload="metadata"
                    />
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="font-medium text-gray-900">{{ a.title }}</p>
                    <p v-if="a.notes" class="text-sm text-gray-600 mt-2 line-clamp-3 whitespace-pre-wrap">{{ a.notes }}</p>
                    <p class="text-xs text-gray-400 mt-2">{{ formatDate(a.updated || a.created) }}</p>
                  </div>
                </div>
                <div class="shrink-0">
                  <details class="relative open:z-30">
                    <summary
                      class="list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none inline-flex items-center px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-800 hover:bg-gray-50"
                    >
                      Actions
                    </summary>
                    <div :class="ACTIONS_MENU_PANEL_CLASS">
                      <a
                        v-if="a.fileUrl"
                        :href="videoAssetPlaybackSrc(a)"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50"
                      >
                        Download file
                      </a>
                      <NuxtLink
                        v-if="a.projectId"
                        :to="`/projects/${a.projectId}/overview`"
                        class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50"
                      >
                        Open project
                      </NuxtLink>
                      <NuxtLink
                        v-if="a.projectId && PB_ID.test(a.projectId)"
                        :to="`/projects/${a.projectId}/timeline`"
                        class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50"
                      >
                        Open timeline
                      </NuxtLink>
                      <button
                        v-if="a.projectId && a.fileUrl"
                        type="button"
                        class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50"
                        @click="addVideoAssetToTimeline(a)"
                      >
                        Add to timeline
                      </button>
                      <button
                        type="button"
                        class="block w-full text-left px-3 py-2 rounded-md text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                        :disabled="deletingId === a.id"
                        @click="removeAsset(a)"
                      >
                        {{ deletingId === a.id ? 'Removing…' : 'Remove' }}
                      </button>
                    </div>
                  </details>
                </div>
              </li>
            </ul>
          </details>
        </template>

        <template v-else-if="props.kind === 'character' && characterProjectGroups.length">
          <details
            v-for="g in characterProjectGroups"
            :key="g.key"
            :class="PROJECT_GROUP_CARD_CLASS"
          >
            <summary
              class="list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none px-4 py-3 bg-gray-50/90 flex flex-wrap items-center justify-between gap-2 hover:bg-gray-100/80 border-b border-transparent group-open:border-gray-200"
            >
              <div class="flex items-start gap-2 min-w-0 flex-1">
                <span
                  class="text-gray-400 text-xs shrink-0 mt-0.5 transition-transform group-open:rotate-90"
                  aria-hidden="true"
                >▶</span>
                <div class="min-w-0">
                  <h2 class="text-sm font-semibold text-gray-900 truncate">
                    {{ g.title }}
                  </h2>
                  <p v-if="g.subtitle" class="text-xs text-gray-500 mt-0.5">
                    {{ g.subtitle }}
                    <span class="text-gray-400"> · {{ g.items.length }} character{{ g.items.length === 1 ? '' : 's' }}</span>
                  </p>
                  <p v-else class="text-xs text-gray-500 mt-0.5">
                    {{ g.items.length }} character{{ g.items.length === 1 ? '' : 's' }}
                  </p>
                </div>
              </div>
              <NuxtLink
                v-if="g.projectId && PB_ID.test(g.projectId)"
                :to="`/projects/${g.projectId}/characters`"
                class="text-xs font-medium text-primary hover:underline shrink-0"
                @click.stop
              >
                Open Characters step →
              </NuxtLink>
            </summary>
            <ul class="divide-y divide-gray-200">
              <li
                v-for="a in g.items"
                :key="a.id"
                class="px-4 py-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
              >
                <div class="min-w-0 flex-1 flex items-start gap-3">
                  <button
                    v-if="a.fileUrl"
                    type="button"
                    class="w-14 h-14 rounded-lg border border-gray-200 overflow-hidden bg-gray-100 shrink-0 cursor-zoom-in hover:ring-2 hover:ring-primary/40 focus:outline-none focus:ring-2 focus:ring-primary transition-shadow"
                    :aria-label="`View full image: ${a.title}`"
                    @click="openImagePreview(a)"
                  >
                    <img
                      :src="characterAssetPlaybackSrc(a)"
                      alt=""
                      class="w-full h-full object-cover pointer-events-none"
                      loading="lazy"
                    >
                  </button>
                  <button
                    v-else-if="a.projectId"
                    type="button"
                    class="w-14 h-14 rounded-lg border border-dashed border-gray-300 bg-gray-50 shrink-0 flex flex-col items-center justify-center text-[10px] leading-tight text-gray-500 hover:border-primary/40 hover:text-primary px-1"
                    :disabled="uploadingCharacterAssetId === a.id"
                    @click="triggerCharacterImageUpload(a)"
                  >
                    {{ uploadingCharacterAssetId === a.id ? '…' : 'Add image' }}
                  </button>
                  <div class="min-w-0 flex-1">
                    <p class="font-medium text-gray-900">{{ a.title }}</p>
                    <p
                      v-if="isFeaturedCharacterAsset(a)"
                      class="text-[11px] font-semibold text-emerald-700 mt-0.5"
                    >
                      Featured image
                    </p>
                    <p v-if="scriptSourceLine(a)" class="text-xs font-medium text-primary mt-1">
                      {{ scriptSourceLine(a) }}
                    </p>
                    <p v-if="a.notes" class="text-sm text-gray-600 mt-2 line-clamp-3 whitespace-pre-wrap">{{ a.notes }}</p>
                    <p class="text-xs text-gray-400 mt-2">{{ formatDate(a.updated || a.created) }}</p>
                  </div>
                </div>
                <div class="shrink-0">
                  <details class="relative open:z-30">
                    <summary
                      class="list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none inline-flex items-center px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-800 hover:bg-gray-50"
                    >
                      Actions
                    </summary>
                    <div :class="ACTIONS_MENU_PANEL_CLASS">
                      <button
                        v-if="a.projectId"
                        type="button"
                        class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                        :disabled="uploadingCharacterAssetId === a.id"
                        @click="triggerCharacterImageUpload(a)"
                      >
                        {{ uploadingCharacterAssetId === a.id ? 'Uploading…' : 'Upload image' }}
                      </button>
                      <a
                        v-if="a.fileUrl"
                        :href="a.fileUrl"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50"
                      >
                        Download file
                      </a>
                      <NuxtLink
                        v-if="a.projectId"
                        :to="`/projects/${a.projectId}/overview`"
                        class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50"
                      >
                        Open project
                      </NuxtLink>
                      <NuxtLink
                        :to="characterCreatorTo(a)"
                        class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50"
                      >
                        Open in Character Creator
                      </NuxtLink>
                      <button
                        v-if="a.projectId && a.fileUrl"
                        type="button"
                        class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                        :disabled="featuringId === a.id"
                        @click="setFeaturedCharacterImage(a)"
                      >
                        {{ featuringId === a.id ? 'Setting…' : 'Set as featured' }}
                      </button>
                      <button
                        type="button"
                        class="block w-full text-left px-3 py-2 rounded-md text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                        :disabled="deletingId === a.id"
                        @click="removeAsset(a)"
                      >
                        {{ deletingId === a.id ? 'Removing…' : 'Remove' }}
                      </button>
                    </div>
                  </details>
                </div>
              </li>
            </ul>
          </details>
        </template>

        <template v-else-if="libraryKindProjectGroups.length">
          <details
            v-for="g in libraryKindProjectGroups"
            :key="g.key"
            :class="PROJECT_GROUP_CARD_CLASS"
          >
            <summary
              class="list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none px-4 py-3 bg-gray-50/90 flex flex-wrap items-center justify-between gap-2 hover:bg-gray-100/80 border-b border-transparent group-open:border-gray-200"
            >
              <div class="flex items-start gap-2 min-w-0 flex-1">
                <span
                  class="text-gray-400 text-xs shrink-0 mt-0.5 transition-transform group-open:rotate-90"
                  aria-hidden="true"
                >▶</span>
                <div class="min-w-0">
                  <h2 class="text-sm font-semibold text-gray-900 truncate">
                    {{ g.projectName }}
                  </h2>
                  <p class="text-xs text-gray-500 mt-0.5">
                    {{ g.items.length }} {{ props.kind }}{{ g.items.length === 1 ? '' : 's' }}
                  </p>
                </div>
              </div>
              <NuxtLink
                v-if="g.projectId && PB_ID.test(g.projectId)"
                :to="projectHubStepTo(g.projectId)"
                class="text-xs font-medium text-primary hover:underline shrink-0"
                @click.stop
              >
                Open project →
              </NuxtLink>
            </summary>
            <ul class="divide-y divide-gray-200">
              <li
                v-for="a in g.items"
                :key="a.id"
                class="px-4 py-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 relative hover:z-10 focus-within:z-10"
              >
                <div class="min-w-0 flex-1 flex items-start gap-3">
                  <button
                    v-if="props.kind === 'storyboard' && libraryImageSrc(a)"
                    type="button"
                    class="w-16 h-24 rounded-lg border border-gray-200 overflow-hidden bg-gray-900 shrink-0 cursor-zoom-in hover:ring-2 hover:ring-primary/40 focus:outline-none focus:ring-2 focus:ring-primary transition-shadow"
                    :aria-label="`View image: ${a.title}`"
                    @click="openImagePreview(a)"
                  >
                    <img
                      :src="libraryImageSrc(a)"
                      alt=""
                      class="w-full h-full object-contain pointer-events-none"
                      loading="lazy"
                    >
                  </button>
                  <div class="min-w-0 flex-1">
                    <button
                      v-if="props.kind === 'storyboard' && libraryImageSrc(a)"
                      type="button"
                      class="font-medium text-gray-900 text-left hover:text-primary hover:underline"
                      @click="openImagePreview(a)"
                    >
                      {{ a.title }}
                    </button>
                    <p v-else class="font-medium text-gray-900">
                      {{ a.title }}
                    </p>
                    <p v-if="scriptSourceLine(a)" class="text-xs font-medium text-primary mt-1">
                      {{ scriptSourceLine(a) }}
                    </p>
                    <p v-if="a.notes" class="text-sm text-gray-600 mt-2 line-clamp-3 whitespace-pre-wrap">{{ a.notes }}</p>
                    <p class="text-xs text-gray-400 mt-2">{{ formatDate(a.updated || a.created) }}</p>
                  </div>
                </div>
                <div class="shrink-0">
                  <details class="relative open:z-30">
                    <summary
                      class="list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none inline-flex items-center px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-800 hover:bg-gray-50"
                    >
                      Actions
                    </summary>
                    <div :class="ACTIONS_MENU_PANEL_CLASS">
                      <button
                        v-if="props.kind === 'storyboard' && libraryImageSrc(a)"
                        type="button"
                        class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50"
                        @click="openImagePreview(a)"
                      >
                        View image
                      </button>
                      <button
                        v-if="props.kind === 'script'"
                        type="button"
                        class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                        :disabled="readingScriptId === a.id"
                        @click="readScriptAsset(a)"
                      >
                        {{ readingScriptId === a.id ? 'Loading…' : 'Read script' }}
                      </button>
                      <a
                        v-if="libraryImageSrc(a)"
                        :href="libraryImageSrc(a)"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50"
                      >
                        Download file
                      </a>
                      <NuxtLink
                        v-if="a.projectId"
                        :to="`/projects/${a.projectId}/overview`"
                        class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50"
                      >
                        Open project
                      </NuxtLink>
                      <NuxtLink
                        v-if="props.kind === 'storyboard' && a.projectId && PB_ID.test(a.projectId)"
                        :to="`/projects/${a.projectId}/storyboard`"
                        class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50"
                      >
                        Open storyboard
                      </NuxtLink>
                      <button
                        type="button"
                        class="block w-full text-left px-3 py-2 rounded-md text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                        :disabled="deletingId === a.id"
                        @click="removeAsset(a)"
                      >
                        {{ deletingId === a.id ? 'Removing…' : 'Remove' }}
                      </button>
                    </div>
                  </details>
                </div>
              </li>
            </ul>
          </details>
        </template>

        <ul
          v-else-if="visibleItems.length"
          class="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white"
        >
          <li
            v-for="a in visibleItems"
            :key="a.id"
            class="px-4 py-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 relative first:rounded-t-xl last:rounded-b-xl hover:z-10 focus-within:z-10"
          >
            <div class="min-w-0 flex-1 flex items-start gap-3">
              <button
                v-if="props.kind === 'character' && a.fileUrl"
                type="button"
                class="w-14 h-14 rounded-lg border border-gray-200 overflow-hidden bg-gray-100 shrink-0 cursor-zoom-in hover:ring-2 hover:ring-primary/40 focus:outline-none focus:ring-2 focus:ring-primary transition-shadow"
                :aria-label="`View full image: ${a.title}`"
                @click="openImagePreview(a)"
              >
                <img
                  :src="characterAssetPlaybackSrc(a)"
                  alt=""
                  class="w-full h-full object-cover pointer-events-none"
                  loading="lazy"
                >
              </button>
              <button
                v-else-if="props.kind === 'character' && a.projectId && !a.fileUrl"
                type="button"
                class="w-14 h-14 rounded-lg border border-dashed border-gray-300 bg-gray-50 shrink-0 flex flex-col items-center justify-center text-[10px] leading-tight text-gray-500 hover:border-primary/40 hover:text-primary px-1"
                :disabled="uploadingCharacterAssetId === a.id"
                @click="triggerCharacterImageUpload(a)"
              >
                {{ uploadingCharacterAssetId === a.id ? '…' : 'Add image' }}
              </button>
              <div
                v-else-if="props.kind === 'video' && a.fileUrl"
                class="w-full max-w-[min(100%,20rem)] sm:max-w-xs rounded-lg border border-gray-200 overflow-hidden bg-black shrink-0"
              >
                <video
                  :src="videoAssetPlaybackSrc(a)"
                  class="w-full aspect-video object-contain"
                  controls
                  playsinline
                  preload="metadata"
                />
              </div>
              <div class="min-w-0 flex-1">
                <p class="font-medium text-gray-900">{{ a.title }}</p>
                <p
                  v-if="props.kind === 'character' && isFeaturedCharacterAsset(a)"
                  class="text-[11px] font-semibold text-emerald-700 mt-0.5"
                >
                  Featured image
                </p>
                <p v-if="scriptSourceLine(a)" class="text-xs font-medium text-primary mt-1">
                  {{ scriptSourceLine(a) }}
                </p>
                <p v-if="a.projectName" class="text-xs text-gray-500 mt-0.5">Project: {{ a.projectName }}</p>
                <p v-if="a.notes" class="text-sm text-gray-600 mt-2 line-clamp-3 whitespace-pre-wrap">{{ a.notes }}</p>
                <p class="text-xs text-gray-400 mt-2">{{ formatDate(a.updated || a.created) }}</p>
              </div>
            </div>
            <div class="shrink-0">
              <details class="relative open:z-30">
                <summary
                  class="list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none inline-flex items-center px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-800 hover:bg-gray-50"
                >
                  Actions
                </summary>
                <div :class="ACTIONS_MENU_PANEL_CLASS">
                  <button
                    v-if="props.kind === 'character' && a.projectId"
                    type="button"
                    class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                    :disabled="uploadingCharacterAssetId === a.id"
                    @click="triggerCharacterImageUpload(a)"
                  >
                    {{ uploadingCharacterAssetId === a.id ? 'Uploading…' : 'Upload image' }}
                  </button>
                  <button
                    v-if="props.kind === 'script'"
                    type="button"
                    class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                    :disabled="readingScriptId === a.id"
                    @click="openScriptReader(a)"
                  >
                    {{ readingScriptId === a.id ? 'Loading…' : 'Read script' }}
                  </button>
                  <a
                    v-if="a.fileUrl"
                    :href="a.fileUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50"
                  >
                    Download file
                  </a>
                  <NuxtLink
                    v-if="a.projectId"
                    :to="projectOverviewPath(a)"
                    class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50"
                  >
                    {{ props.kind === 'script' && scriptNeedsFullImport(a) ? 'Import into project' : 'Open project' }}
                  </NuxtLink>
                  <NuxtLink
                    v-if="props.kind === 'character'"
                    :to="characterCreatorTo(a)"
                    class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50"
                  >
                    Open in Character Creator
                  </NuxtLink>
                  <button
                    v-if="props.kind === 'character' && a.projectId && a.fileUrl"
                    type="button"
                    class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                    :disabled="featuringId === a.id"
                    @click="setFeaturedCharacterImage(a)"
                  >
                    {{ featuringId === a.id ? 'Setting…' : 'Set as featured' }}
                  </button>
                  <button
                    type="button"
                    class="block w-full text-left px-3 py-2 rounded-md text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                    :disabled="deletingId === a.id"
                    @click="removeAsset(a)"
                  >
                    {{ deletingId === a.id ? 'Removing…' : 'Remove' }}
                  </button>
                </div>
              </details>
            </div>
          </li>
        </ul>

        <div
          v-else
          class="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center"
        >
          <p class="text-gray-700 text-sm mb-2">Nothing in this library yet.</p>
          <p class="text-gray-500 text-sm mb-4">
            {{ emptyHint }}
          </p>
        </div>
      </template>
    </ClientOnly>

    <input
      ref="characterImageFileInput"
      type="file"
      class="hidden"
      accept="image/jpeg,image/png,image/webp,image/gif,image/*"
      @change="onCharacterImageFilePicked"
    >

    <Teleport to="body">
      <div
        v-if="expandedImage"
        class="fixed inset-0 z-[110] bg-black/92 flex flex-col p-4 sm:p-6"
        role="dialog"
        aria-modal="true"
        :aria-label="expandedImage.title"
        @click.self="closeImagePreview"
      >
        <div class="max-w-6xl w-full mx-auto flex flex-col flex-1 min-h-0">
          <div class="flex justify-between items-center gap-3 mb-3 text-white shrink-0">
            <p class="text-sm font-medium truncate">
              {{ expandedImage.title }}
            </p>
            <div class="flex items-center gap-2 shrink-0">
              <a
                v-if="expandedImage.downloadUrl"
                :href="expandedImage.downloadUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 border border-white/20"
              >
                Download
              </a>
              <button
                type="button"
                class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 border border-white/20"
                @click="closeImagePreview"
              >
                Close
              </button>
            </div>
          </div>
          <img
            :src="expandedImage.url"
            :alt="expandedImage.title"
            class="w-full flex-1 min-h-[40vh] max-h-[calc(100vh-5rem)] rounded-lg object-contain mx-auto"
          >
        </div>
      </div>

      <div
        v-if="expandedScript"
        class="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-4 bg-black/50"
        role="dialog"
        aria-modal="true"
        :aria-label="expandedScript.title"
        @click.self="closeScriptReader"
      >
        <div
          class="w-full max-w-3xl max-h-[min(92vh,48rem)] rounded-xl border border-gray-200 bg-white shadow-xl flex flex-col overflow-hidden"
          @click.stop
        >
          <div class="flex justify-between items-start gap-3 px-5 py-4 border-b border-gray-200 shrink-0">
            <div class="min-w-0">
              <h2 class="text-lg font-semibold text-gray-900 truncate">
                {{ expandedScript.title }}
              </h2>
              <p v-if="expandedScript.partial" class="text-xs text-amber-800 mt-1">
                Showing synopsis only — full screenplay text was not available for this entry.
              </p>
            </div>
            <button
              type="button"
              class="shrink-0 px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              @click="closeScriptReader"
            >
              Close
            </button>
          </div>
          <pre class="flex-1 overflow-y-auto px-5 py-4 text-sm text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">{{ expandedScript.text }}</pre>
        </div>
      </div>

      <div
        v-if="openAdd"
        class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/50"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="modalTitleId"
        @click.self="closeAdd"
      >
        <div
          class="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl p-6 max-h-[90vh] overflow-y-auto"
          @click.stop
        >
          <h2 :id="modalTitleId" class="text-lg font-semibold text-gray-900 mb-4">
            Add {{ addButtonLabel }}
          </h2>
          <p v-if="!pbProjects.length" class="text-sm text-amber-800 mb-4">
            You need at least one project saved to your account. Create or import a project first.
          </p>
          <form v-else class="space-y-4" @submit.prevent="submitAdd">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1" for="asset-project">Project</label>
              <select
                id="asset-project"
                v-model="addForm.projectId"
                required
                class="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm"
              >
                <option value="" disabled>Select project</option>
                <option v-for="p in pbProjects" :key="p.id" :value="p.id">
                  {{ p.name }}
                </option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1" for="asset-title">Title</label>
              <input
                id="asset-title"
                v-model="addForm.title"
                type="text"
                required
                maxlength="500"
                class="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm"
                placeholder="e.g. Draft v2, Reference sheet"
              >
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1" for="asset-notes">Notes (optional)</label>
              <textarea
                id="asset-notes"
                v-model="addForm.notes"
                rows="4"
                maxlength="20000"
                class="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm resize-y"
                placeholder="Description, links, or paste text…"
              />
            </div>
            <p v-if="addError" class="text-sm text-red-700">{{ addError }}</p>
            <div class="flex justify-end gap-2 pt-2">
              <button
                type="button"
                class="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
                @click="closeAdd"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="px-4 py-2 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg text-sm disabled:opacity-50"
                :disabled="adding"
              >
                {{ adding ? 'Saving…' : 'Save' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { appendVideoToProjectTimeline } from '~/lib/append-project-timeline-video'
import { formatApiFetchError } from '~/lib/format-api-fetch-error'
import { visualBriefForCharacterCreator } from '~/lib/character-visual-description'
import { prepareImageFileForUpload } from '~/lib/image-blob-client'
import { groupProjectAssetsByProject, sortProjectAssetsWithinProjectByKind } from '~/lib/project-asset-sort'
import { appendPlaybackAccessToken, projectAssetMediaPath } from '~/lib/project-asset-playback-url'
import type { ProjectAsset, ProjectAssetKind } from '~/types/project-asset'
import type { CreativeProject } from '~/types/creative-project'

const PB_ID = /^[a-z0-9]{15}$/

/** Opens upward so menus are not clipped at the bottom of scroll areas / viewport. */
const ACTIONS_MENU_PANEL_CLASS =
  'absolute right-0 bottom-full mb-2 z-50 min-w-[13rem] max-w-[calc(100vw-2rem)] max-h-[min(70vh,20rem)] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg p-1'

const PROJECT_GROUP_CARD_CLASS =
  'mb-4 rounded-xl border border-gray-200 bg-white group overflow-visible'

const props = defineProps<{
  kind: ProjectAssetKind
  headline: string
  blurb: string
  /** Primary + secondary CTAs */
  actions: { to: string; label: string; primary?: boolean }[]
  emptyHint: string
}>()

const addButtonLabel = computed(() => {
  const m: Record<ProjectAssetKind, string> = {
    script: 'script entry',
    character: 'character asset',
    storyboard: 'storyboard entry',
    video: 'video entry',
    other: 'entry'
  }
  return m[props.kind] || 'entry'
})

const modalTitleId = `asset-add-${props.kind}`

const { isAuthenticated, initAuth, getAuthToken } = useAuth()
const authTokenState = useState<string | null>('auth_token')
const { projects, loadServerProjects, clientReady } = useCreativeProject()
const toast = useToast()
const route = useRoute()

const loading = ref(true)
const loadError = ref('')
const items = ref<ProjectAsset[]>([])
const openAdd = ref(false)
const expandedImage = ref<{ url: string; title: string; downloadUrl: string } | null>(null)
const expandedScript = ref<{ title: string; text: string; partial?: boolean } | null>(null)
const readingScriptId = ref('')
const adding = ref(false)
const addError = ref('')
const deletingId = ref('')
const featuringId = ref('')
const uploadingCharacterAssetId = ref('')
const characterImageFileInput = ref<HTMLInputElement | null>(null)
const uploadTargetAsset = ref<ProjectAsset | null>(null)

const addForm = reactive({
  projectId: '',
  title: '',
  notes: ''
})

const pbProjects = computed(() =>
  projects.value.filter((p: CreativeProject) => PB_ID.test(p.id))
)

function formatDate (iso: string) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    })
  } catch {
    return iso
  }
}

function assetMediaPlaybackSrc (a: ProjectAsset): string {
  void authTokenState.value
  if (!a.id || !a.projectId || !PB_ID.test(a.projectId)) {
    return (a.fileUrl || '').trim()
  }
  return appendPlaybackAccessToken(projectAssetMediaPath(a.projectId, a.id), getAuthToken())
}

function videoAssetPlaybackSrc (a: ProjectAsset): string {
  if (props.kind !== 'video') return (a.fileUrl || '').trim()
  return assetMediaPlaybackSrc(a)
}

function characterAssetPlaybackSrc (a: ProjectAsset): string {
  if (props.kind !== 'character') return (a.fileUrl || '').trim()
  return assetMediaPlaybackSrc(a)
}

function libraryImageSrc (a: ProjectAsset): string {
  if (!a.id) return (a.fileUrl || '').trim()
  if (props.kind === 'storyboard' || props.kind === 'character') {
    return assetMediaPlaybackSrc(a)
  }
  return (a.fileUrl || '').trim()
}

function openImagePreview (a: ProjectAsset) {
  const url =
    props.kind === 'character'
      ? characterAssetPlaybackSrc(a)
      : libraryImageSrc(a)
  if (!url) return
  expandedImage.value = {
    url,
    title: a.title || (props.kind === 'storyboard' ? 'Storyboard frame' : 'Character image'),
    downloadUrl: url
  }
}

function closeImagePreview () {
  expandedImage.value = null
}

async function openScriptReader (a: ProjectAsset) {
  const token = getAuthToken()
  if (!token) {
    toast.showToast('Sign in to read scripts.', 'info')
    return
  }
  readingScriptId.value = a.id
  try {
    const res = await $fetch<{ title: string; text: string; partial?: boolean }>(
      `/api/assets/${a.id}/script-text`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    expandedScript.value = {
      title: res.title || a.title || 'Script',
      text: res.text || '',
      partial: res.partial
    }
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message || 'Could not load script')
        : 'Could not load script'
    toast.showToast(msg, 'error')
  } finally {
    readingScriptId.value = ''
  }
}

function closeScriptReader () {
  expandedScript.value = null
}

/** Where a script file came from + whether AI import was run (scripts hub only). */
function scriptNeedsFullImport (a: ProjectAsset): boolean {
  if (props.kind !== 'script') return false
  const meta = a.metadata
  if (!meta || typeof meta !== 'object') return false
  const source = typeof meta.source === 'string' ? meta.source : ''
  if (source !== 'script_import') return false
  const status = typeof meta.analysis_status === 'string' ? meta.analysis_status : ''
  return status === 'pending' || status === ''
}

function projectOverviewPath (a: ProjectAsset): string {
  if (!a.projectId) return '/projects'
  if (props.kind === 'script' && scriptNeedsFullImport(a)) {
    return `/projects/${a.projectId}/overview?bootstrap=1`
  }
  return `/projects/${a.projectId}/overview`
}

function scriptSourceLine (a: ProjectAsset): string {
  if (props.kind !== 'script') return ''
  const meta = a.metadata
  if (!meta || typeof meta !== 'object') return ''
  const source = typeof meta.source === 'string' ? meta.source : ''
  const analysisStatus = typeof meta.analysis_status === 'string' ? meta.analysis_status : ''

  if (source === 'script_import') {
    if (analysisStatus === 'pending') {
      return 'Saved from a project · run director analysis on Overview when ready'
    }
    if (analysisStatus === 'director_ready') {
      return 'Director analysis done · generate scenes on Scenes, cast on Characters, panels on Storyboard'
    }
    if (analysisStatus === 'complete') {
      return 'Saved from a project · scene breakdown saved (full workflow)'
    }
    return 'Saved from a project'
  }
  if (source === 'script_wizard_upload') {
    return 'Script Wizard'
  }
  return ''
}

function firstQueryString (v: unknown): string {
  if (typeof v === 'string') return v
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0]
  return ''
}

function normalizeName (v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Synthetic list rows from `creative_characters` — not PATCHable as `project_assets`. */
function isStoredProjectAsset (a: ProjectAsset): boolean {
  return PB_ID.test(a.id) && !a.id.startsWith('charrow_')
}

function characterMetaFromAsset (a: ProjectAsset): { id: string; name: string } {
  const meta = (a.metadata && typeof a.metadata === 'object') ? a.metadata : {}
  const id = typeof meta.character_id === 'string' ? meta.character_id.trim() : ''
  const name = typeof meta.character_name === 'string' ? meta.character_name.trim() : ''
  if (name) return { id, name }
  const baseTitle = (a.title || '').split('—')[0]?.trim() || ''
  return { id, name: baseTitle }
}

function characterDedupeKey (a: ProjectAsset): string {
  const pid = (a.projectId && PB_ID.test(a.projectId)) ? a.projectId : ''
  const projectPrefix = pid ? `p:${pid}:` : 'p:__none__:'
  const m = characterMetaFromAsset(a)
  if (m.id && PB_ID.test(m.id)) return `${projectPrefix}id:${m.id}`
  const n = normalizeName(m.name)
  if (n) return `${projectPrefix}name:${n}`
  // Last resort: keep each row distinct
  return `${projectPrefix}asset:${a.id}`
}

function isFeaturedCharacterAsset (a: ProjectAsset): boolean {
  const meta = a.metadata
  return !!(meta && typeof meta === 'object' && meta.featured === true)
}

function characterAssetRank (a: ProjectAsset): number {
  let score = 0
  if (a.fileUrl) score += 1_000_000
  if (isFeaturedCharacterAsset(a)) score += 500_000
  const ts = (a.updated || a.created || '').trim()
  // ISO strings sort lexicographically; missing dates sink to bottom within same bucket.
  for (let i = 0; i < ts.length; i++) score += ts.charCodeAt(i)
  return score
}

function dedupeCharacterAssets (list: ProjectAsset[]): ProjectAsset[] {
  if (props.kind !== 'character') return list
  const best = new Map<string, ProjectAsset>()
  for (const a of list) {
    const k = characterDedupeKey(a)
    const prev = best.get(k)
    if (!prev) {
      best.set(k, a)
      continue
    }
    if (characterAssetRank(a) > characterAssetRank(prev)) best.set(k, a)
  }
  return [...best.values()]
}

function characterCreatorTo (a: ProjectAsset) {
  const m = characterMetaFromAsset(a)
  const name = (m.name || (a.title || '').split('—')[0]?.trim() || a.title || '').slice(0, 200)
  const meta = a.metadata && typeof a.metadata === 'object' ? (a.metadata as Record<string, unknown>) : null
  const promptUsed =
    meta && typeof meta.prompt_used === 'string' ? meta.prompt_used.trim() : ''
  const description = visualBriefForCharacterCreator({
    name,
    roleDescription: '',
    portraitUrl: a.fileUrl,
    portraitNotes: (a.notes || '').trim(),
    portraitPromptUsed: promptUsed
  })
  const q: Record<string, string> = { name }
  if (description) q.description = description
  if (a.projectId && PB_ID.test(a.projectId)) q.projectId = a.projectId
  if (m.id && PB_ID.test(m.id)) q.characterId = m.id
  return {
    path: '/character-creator',
    query: q
  }
}

const characterFilterId = computed(() => firstQueryString(route.query.characterId).trim())
const characterFilterName = computed(() => firstQueryString(route.query.characterName).trim())
const characterFilterProjectId = computed(() => firstQueryString(route.query.projectId).trim())
const characterFilterLabel = computed(() => {
  if (props.kind !== 'character') return ''
  return characterFilterName.value || characterFilterId.value || ''
})

const visibleItems = computed(() => {
  let out = [...items.value]
  if (props.kind !== 'character') return out
  if (characterFilterProjectId.value) {
    out = out.filter(a => a.projectId === characterFilterProjectId.value)
  }
  if (!characterFilterId.value && !characterFilterName.value) {
    return dedupeCharacterAssets(out)
  }
  const wantedName = normalizeName(characterFilterName.value)
  const filtered = out.filter((a) => {
    const m = characterMetaFromAsset(a)
    if (characterFilterId.value && m.id === characterFilterId.value) return true
    if (wantedName) {
      if (normalizeName(m.name) === wantedName) return true
      if (normalizeName(a.title || '').includes(wantedName)) return true
    }
    return false
  })
  return dedupeCharacterAssets(filtered)
})

type AssetProjectGroup = {
  key: string
  projectId: string
  title: string
  subtitle: string
  items: ProjectAsset[]
}

function sortCharacterAssetsForDisplay (list: ProjectAsset[]): ProjectAsset[] {
  return [...list].sort((a, b) => {
    const af = isFeaturedCharacterAsset(a) ? 1 : 0
    const bf = isFeaturedCharacterAsset(b) ? 1 : 0
    if (bf !== af) return bf - af
    const ta = a.updated || a.created || ''
    const tb = b.updated || b.created || ''
    return tb.localeCompare(ta)
  })
}

function buildProjectAssetGroups (
  list: ProjectAsset[],
  sortItems: (rows: ProjectAsset[]) => ProjectAsset[]
): AssetProjectGroup[] {
  const byPid = new Map<string, ProjectAsset[]>()
  for (const a of list) {
    const pid = (a.projectId && PB_ID.test(a.projectId)) ? a.projectId : ''
    const key = pid || '__unassigned__'
    const cur = byPid.get(key) || []
    cur.push(a)
    byPid.set(key, cur)
  }
  const groups: AssetProjectGroup[] = []
  for (const [key, raw] of byPid.entries()) {
    const pid = key === '__unassigned__' ? '' : key
    const nameFromAsset = raw.find(a => a.projectName)?.projectName?.trim() || ''
    const nameFromStore =
      pid ? (projects.value.find(p => p.id === pid)?.name || '').trim() : ''
    const projectName = nameFromAsset || nameFromStore || (pid ? 'Project' : '')
    const title = pid ? projectName || 'Project' : 'No project assigned'
    const subtitle = pid ? `Project id: ${pid}` : 'These entries are not linked to a PocketBase project id.'
    groups.push({
      key,
      projectId: pid,
      title,
      subtitle,
      items: sortItems(raw)
    })
  }
  groups.sort((a, b) => {
    if (!a.projectId && b.projectId) return 1
    if (!b.projectId && a.projectId) return -1
    return a.title.localeCompare(b.title)
  })
  return groups
}

function sortVideoAssetsForDisplay (list: ProjectAsset[]): ProjectAsset[] {
  return [...list].sort((a, b) =>
    String(b.updated || b.created || '').localeCompare(String(a.updated || a.created || ''))
  )
}

const characterProjectGroups = computed<AssetProjectGroup[]>(() => {
  if (props.kind !== 'character') return []
  return buildProjectAssetGroups(visibleItems.value, sortCharacterAssetsForDisplay)
})

const videoProjectGroups = computed<AssetProjectGroup[]>(() => {
  if (props.kind !== 'video') return []
  return buildProjectAssetGroups(visibleItems.value, sortVideoAssetsForDisplay)
})

const libraryKindProjectGroups = computed(() => {
  if (props.kind === 'character' || props.kind === 'video') return []
  return groupProjectAssetsByProject(visibleItems.value, sortProjectAssetsWithinProjectByKind)
})

function projectHubStepTo (projectId: string): string {
  if (props.kind === 'storyboard') return `/projects/${projectId}/storyboard`
  if (props.kind === 'script') return `/projects/${projectId}/overview`
  return `/projects/${projectId}/overview`
}

function addVideoAssetToTimeline (a: ProjectAsset) {
  if (!a.projectId || !PB_ID.test(a.projectId) || !a.id) return
  const src = videoAssetPlaybackSrc(a)
  if (!src) return
  const meta = (a.metadata && typeof a.metadata === 'object') ? a.metadata : {}
  const sceneId = typeof meta.scene_id === 'string' ? meta.scene_id : undefined
  const shotId = typeof meta.shot_id === 'string' ? meta.shot_id : undefined
  appendVideoToProjectTimeline(a.projectId, {
    url: src,
    label: (a.title || 'Video clip').slice(0, 500),
    sceneId,
    shotId
  })
  toast.showToast('Added to project timeline.', 'success')
}

async function fetchItems () {
  if (!import.meta.client || !isAuthenticated.value) {
    loading.value = false
    return
  }
  const token = getAuthToken()
  if (!token) {
    loading.value = false
    return
  }
  loading.value = true
  loadError.value = ''
  try {
    await initAuth()
    const res = await $fetch<{ items: ProjectAsset[] }>(`/api/assets/my?kind=${encodeURIComponent(props.kind)}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    items.value = res.items ?? []
  } catch (e) {
    loadError.value = formatApiFetchError(e, 'Could not load assets')
  } finally {
    loading.value = false
  }
}

watch([isAuthenticated, clientReady], () => {
  if (isAuthenticated.value && clientReady.value) {
    void loadServerProjects()
  }
})

onMounted(() => {
  if (isAuthenticated.value && clientReady.value) {
    void loadServerProjects()
  }
  void fetchItems()
})

watch(isAuthenticated, (v) => {
  if (v) {
    void loadServerProjects()
    void fetchItems()
  } else {
    items.value = []
    loading.value = false
  }
})

function closeAdd () {
  if (adding.value) return
  openAdd.value = false
  addError.value = ''
  addForm.projectId = ''
  addForm.title = ''
  addForm.notes = ''
}

async function submitAdd () {
  const token = getAuthToken()
  if (!token || !addForm.projectId) return
  adding.value = true
  addError.value = ''
  try {
    await $fetch(`/api/projects/${addForm.projectId}/assets`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        kind: props.kind,
        title: addForm.title.trim(),
        notes: addForm.notes.trim(),
        sort_order: 0
      }
    })
    toast.showToast('Saved to library.', 'success')
    closeAdd()
    await fetchItems()
  } catch (e) {
    addError.value =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message ?? 'Save failed')
        : 'Save failed'
  } finally {
    adding.value = false
  }
}

async function removeAsset (a: ProjectAsset) {
  const token = getAuthToken()
  if (!token) return
  if (!confirm(`Remove “${a.title}” from this library?`)) return
  deletingId.value = a.id
  try {
    const meta = a.metadata as { source?: string; character_id?: string } | null
    if (props.kind === 'character' && meta?.source === 'creative_character_row' && a.projectId && meta.character_id) {
      await $fetch(`/api/projects/${a.projectId}/characters/${meta.character_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
    } else if (a.projectId) {
      await $fetch(`/api/projects/${a.projectId}/assets/${a.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
    } else {
      await $fetch(`/api/assets/${a.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
    }
    toast.showToast('Removed.', 'success')
    await fetchItems()
  } catch {
    toast.showToast('Could not remove.', 'error')
  } finally {
    deletingId.value = ''
  }
}

function characterDisplayName (a: ProjectAsset): string {
  const m = characterMetaFromAsset(a)
  const fromTitle = (a.title || '').split('—')[0]?.trim() || ''
  return (m.name || fromTitle || a.title || 'Character').slice(0, 200)
}

async function resolveOrCreateCharacterForUpload (
  projectId: string,
  characterName: string,
  roleDescription: string,
  token: string
): Promise<{ id: string; name: string }> {
  const targetName = characterName.trim().slice(0, 200) || 'Character'
  const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, ' ')
  const existing = await $fetch<{ characters: Array<{ id: string; name: string }> }>(
    `/api/projects/${projectId}/characters`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const hit = (existing.characters || []).find(c => norm(c.name || '') === norm(targetName))
  if (hit?.id) return { id: hit.id, name: hit.name || targetName }
  const created = await $fetch<{ character?: { id: string; name: string } }>(
    `/api/projects/${projectId}/characters`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        name: targetName,
        roleDescription: roleDescription.slice(0, 10_000),
        screenSharePercent: null
      }
    }
  )
  if (created.character?.id) {
    return { id: created.character.id, name: created.character.name || targetName }
  }
  throw new Error('Could not create character row for this image.')
}

function triggerCharacterImageUpload (a: ProjectAsset) {
  if (props.kind !== 'character' || !a.projectId) return
  uploadTargetAsset.value = a
  characterImageFileInput.value?.click()
}

async function onCharacterImageFilePicked (ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  const target = uploadTargetAsset.value
  uploadTargetAsset.value = null
  if (!file || !target?.projectId) return
  if (!file.type.startsWith('image/')) {
    toast.showToast('Choose an image file (JPEG, PNG, WebP, or GIF).', 'warning')
    return
  }
  const token = getAuthToken()
  if (!token) return
  uploadingCharacterAssetId.value = target.id
  try {
    const uploadFile = await prepareImageFileForUpload(file)
    const charName = characterDisplayName(target)
    const linked = await resolveOrCreateCharacterForUpload(
      target.projectId,
      charName,
      target.notes || '',
      token
    )
    const fd = new FormData()
    fd.append('file', uploadFile)
    fd.append('kind', 'character')
    fd.append('title', `${charName} — uploaded`.slice(0, 500))
    fd.append('notes', (target.notes || '').slice(0, 20_000))
    fd.append(
      'metadata',
      JSON.stringify({
        source: 'character_upload',
        character_name: linked.name,
        character_id: linked.id,
        featured: true
      })
    )
    const res = await $fetch<{ asset: ProjectAsset }>(
      `/api/projects/${target.projectId}/assets/upload`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd
      }
    )
    toast.showToast('Image uploaded.', 'success')
    if (res.asset) {
      try {
        await setFeaturedCharacterImage(res.asset)
      } catch {
        await fetchItems()
      }
    } else {
      await fetchItems()
    }
  } catch (e: unknown) {
    const status =
      e && typeof e === 'object' && 'statusCode' in e
        ? Number((e as { statusCode?: number }).statusCode)
        : 0
    if (status === 413) {
      toast.showToast(
        'Image is too large for the server. We resized it automatically — try again, or use a smaller file.',
        'error'
      )
    } else {
      toast.showToast(formatApiFetchError(e, 'Could not upload image'), 'error')
    }
  } finally {
    uploadingCharacterAssetId.value = ''
  }
}

async function setFeaturedCharacterImage (target: ProjectAsset) {
  if (props.kind !== 'character' || !target.projectId) return
  const token = getAuthToken()
  if (!token) return
  const targetMeta = characterMetaFromAsset(target)
  if (!targetMeta.id && !targetMeta.name) {
    toast.showToast('This image is not linked to a character yet.', 'warning')
    return
  }
  featuringId.value = target.id
  try {
    const peers = items.value.filter((a) => {
      if (a.projectId !== target.projectId) return false
      const m = characterMetaFromAsset(a)
      if (targetMeta.id && m.id) return m.id === targetMeta.id
      return normalizeName(m.name) === normalizeName(targetMeta.name)
    })
    for (const a of peers) {
      if (!isStoredProjectAsset(a)) continue
      const baseMeta = (a.metadata && typeof a.metadata === 'object') ? a.metadata : {}
      await $fetch(`/api/projects/${a.projectId}/assets/${a.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: {
          metadata: {
            ...baseMeta,
            character_id: targetMeta.id || (typeof baseMeta.character_id === 'string' ? baseMeta.character_id : ''),
            character_name: targetMeta.name || (typeof baseMeta.character_name === 'string' ? baseMeta.character_name : ''),
            featured: a.id === target.id
          }
        }
      })
    }
    toast.showToast('Featured image updated.', 'success')
    await fetchItems()
  } catch (e) {
    toast.showToast(formatApiFetchError(e, 'Could not update featured image'), 'error')
  } finally {
    featuringId.value = ''
  }
}

useHead({
  title: `${props.headline} — Assets`
})
</script>
