<template>
  <ul class="space-y-3">
    <li
      v-for="g in groups"
      :key="g.key"
    >
      <NuxtLink
        v-if="g.projectId && PB_ID.test(g.projectId)"
        :to="`/projects/${g.projectId}/video`"
        :class="PROJECT_GROUP_CARD_CLASS"
        class="block px-4 py-3 hover:bg-gray-50/80 transition-colors group"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="min-w-0 flex-1">
            <h2 class="text-sm font-semibold text-gray-900 truncate group-hover:text-primary transition-colors">
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
          <span class="text-xs font-medium text-primary shrink-0">
            Open videos →
          </span>
        </div>
      </NuxtLink>
      <div
        v-else
        :class="PROJECT_GROUP_CARD_CLASS"
        class="px-4 py-3"
      >
        <h2 class="text-sm font-semibold text-gray-900 truncate">{{ g.title }}</h2>
        <p class="text-xs text-gray-500 mt-0.5">
          {{ g.items.length }} clip{{ g.items.length === 1 ? '' : 's' }}
          <span class="text-gray-400"> · no project link</span>
        </p>
      </div>
    </li>
  </ul>
</template>

<script setup lang="ts">
import {
  PB_ID,
  PROJECT_GROUP_CARD_CLASS,
  type AssetProjectGroup
} from '~/lib/asset-kind-display'

defineProps<{
  groups: AssetProjectGroup[]
}>()
</script>
