<template>
  <div v-if="!clientReady" class="rounded-xl border border-primary/20 bg-primary/5 px-6 py-10">
    <FilmReelLoader
      size="md"
      :label="loadingLabel"
      :sub-label="loadingSubLabel"
    />
  </div>

  <div
    v-else-if="!isCloudProject"
    class="rounded-xl border border-amber-200 bg-amber-50 p-5 sm:p-6 text-sm text-amber-900"
  >
    <p class="font-medium text-amber-950 mb-2">
      Cloud project required
    </p>
    <p class="leading-relaxed">
      <slot name="message">
        {{ featureLabel }} needs a project saved to your account (not a browser-only demo).
        Open or create a cloud project from
        <NuxtLink to="/projects" class="underline font-medium text-primary">Projects</NuxtLink>,
        then return here.
      </slot>
    </p>
  </div>

  <slot v-else />
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    featureLabel?: string
    loadingLabel?: string
    loadingSubLabel?: string
  }>(),
  {
    featureLabel: 'This step',
    loadingLabel: 'Loading project',
    loadingSubLabel: 'Checking project workspace…'
  }
)

const { activeProject, clientReady } = useCreativeProject()

const isCloudProject = computed(() => {
  const id = activeProject.value?.id || ''
  return activeProject.value?.source === 'pocketbase' || /^[a-z0-9]{15}$/.test(id)
})
</script>
