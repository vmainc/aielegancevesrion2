<template>
  <div
    class="flex flex-col items-center justify-center gap-3 text-center"
    :class="wrapperClass"
  >
    <div
      class="text-primary"
      :class="svgWrapClass"
      aria-hidden="true"
    >
      <svg
        :class="svgClass"
        viewBox="0 0 200 72"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <!-- Left reel (centered at 36,36) -->
        <g transform="translate(36 36)">
          <g class="sw-reel-left">
            <circle cx="0" cy="0" r="30" stroke="currentColor" stroke-width="3" fill="none" class="opacity-90" />
            <circle cx="0" cy="0" r="10" stroke="currentColor" stroke-width="2" fill="none" opacity="0.5" />
            <circle cx="0" cy="-22" r="4" fill="currentColor" />
            <circle cx="16" cy="-10" r="4" fill="currentColor" />
            <circle cx="16" cy="10" r="4" fill="currentColor" />
            <circle cx="0" cy="22" r="4" fill="currentColor" />
            <circle cx="-16" cy="10" r="4" fill="currentColor" />
            <circle cx="-16" cy="-10" r="4" fill="currentColor" />
          </g>
        </g>
        <!-- Film strip -->
        <g class="text-primary/90">
          <path
            d="M66 28 H134 M66 36 H134 M66 44 H134"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
          <path
            d="M70 24 v48 M78 24 v48 M86 24 v48 M94 24 v48 M102 24 v48 M110 24 v48 M118 24 v48 M126 24 v48"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-dasharray="2 5"
            class="sw-film-perf"
          />
        </g>
        <!-- Right reel (centered at 164,36) -->
        <g transform="translate(164 36)">
          <g class="sw-reel-right">
            <circle cx="0" cy="0" r="30" stroke="currentColor" stroke-width="3" fill="none" class="opacity-90" />
            <circle cx="0" cy="0" r="10" stroke="currentColor" stroke-width="2" fill="none" opacity="0.5" />
            <circle cx="0" cy="-22" r="4" fill="currentColor" />
            <circle cx="16" cy="-10" r="4" fill="currentColor" />
            <circle cx="16" cy="10" r="4" fill="currentColor" />
            <circle cx="0" cy="22" r="4" fill="currentColor" />
            <circle cx="-16" cy="10" r="4" fill="currentColor" />
            <circle cx="-16" cy="-10" r="4" fill="currentColor" />
          </g>
        </g>
      </svg>
    </div>
    <div class="space-y-1 max-w-xs">
      <p v-if="label" class="font-medium text-gray-800" :class="labelClass">{{ label }}</p>
      <p v-if="subLabel" class="text-gray-500" :class="subLabelClass">{{ subLabel }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    label?: string
    subLabel?: string
    size?: 'sm' | 'md' | 'lg'
  }>(),
  { size: 'md', label: '', subLabel: '' }
)

const wrapperClass = computed(() => {
  if (props.size === 'sm') return 'py-2'
  if (props.size === 'lg') return 'py-8 px-4'
  return 'py-4'
})

const svgWrapClass = computed(() => {
  if (props.size === 'sm') return 'scale-[0.65]'
  if (props.size === 'lg') return 'scale-110'
  return ''
})

const svgClass = computed(() => {
  if (props.size === 'sm') return 'h-10 w-40'
  if (props.size === 'lg') return 'h-20 w-52'
  return 'h-14 w-48'
})

const labelClass = computed(() => {
  if (props.size === 'sm') return 'text-xs'
  if (props.size === 'lg') return 'text-base'
  return 'text-sm'
})

const subLabelClass = computed(() => {
  if (props.size === 'sm') return 'text-[11px]'
  if (props.size === 'lg') return 'text-sm'
  return 'text-xs'
})
</script>

<style scoped>
.sw-reel-left {
  transform-origin: 0 0;
  animation: sw-reel-spin 2.8s linear infinite;
}
.sw-reel-right {
  transform-origin: 0 0;
  animation: sw-reel-spin 2.8s linear infinite reverse;
}
@keyframes sw-reel-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
.sw-film-perf {
  animation: sw-film-march 0.85s linear infinite;
}
@keyframes sw-film-march {
  from {
    stroke-dashoffset: 0;
  }
  to {
    stroke-dashoffset: 14;
  }
}
@media (prefers-reduced-motion: reduce) {
  .sw-reel-left,
  .sw-reel-right,
  .sw-film-perf {
    animation: none;
  }
}
</style>
