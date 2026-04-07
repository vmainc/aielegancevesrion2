<template>
  <div class="flex flex-col sm:flex-row sm:items-start gap-8">
    <div class="shrink-0 flex flex-col items-center">
      <svg
        class="w-52 h-52 sm:w-60 sm:h-60 drop-shadow-sm"
        viewBox="-1.05 -1.05 2.1 2.1"
        role="img"
        :aria-label="ariaLabel"
      >
        <template v-if="segments.length">
          <path
            v-for="(seg, i) in segments"
            :key="i"
            :d="seg.d"
            :fill="seg.color"
            stroke="white"
            stroke-width="0.03"
            vector-effect="non-scaling-stroke"
          />
        </template>
        <circle
          v-else
          cx="0"
          cy="0"
          r="0.92"
          class="fill-gray-200"
        />
      </svg>
      <p class="mt-2 text-xs text-gray-500 text-center max-w-[13rem]">
        Estimated share of dialogue + notable on-page presence from the imported script (not final runtime).
      </p>
    </div>
    <ul class="flex-1 space-y-2 min-w-0" aria-hidden="true">
      <li
        v-for="(s, i) in legend"
        :key="i"
        class="flex items-start gap-2 text-sm"
      >
        <span
          class="mt-1.5 h-2.5 w-2.5 rounded-sm shrink-0"
          :style="{ backgroundColor: s.color?.trim() ? s.color : palette[i % palette.length] }"
        />
        <span class="text-gray-800 min-w-0">
          <span class="font-medium">{{ s.label }}</span>
          <span class="text-gray-500"> — {{ s.percent.toFixed(1) }}%</span>
        </span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  slices: { label: string; percent: number; color: string }[]
}>()

const palette = [
  '#41aaa8',
  '#2d7d7a',
  '#5fb3b0',
  '#1a5c59',
  '#7fc4c1',
  '#0d3d3b',
  '#9dd5d2',
  '#3a8f8c',
  '#6a9e9c',
  '#4a9491',
  '#2a6865',
  '#8cc9c6'
]

function segmentPath (startAngle: number, angleSize: number): string {
  const r = 0.92
  if (angleSize >= 2 * Math.PI - 0.001) {
    return `M 0 0 m -${r} 0 a ${r} ${r} 0 1 1 ${r * 2} 0 a ${r} ${r} 0 1 1 -${r * 2} 0`
  }
  const x1 = Math.cos(startAngle) * r
  const y1 = Math.sin(startAngle) * r
  const end = startAngle + angleSize
  const x2 = Math.cos(end) * r
  const y2 = Math.sin(end) * r
  const large = angleSize > Math.PI ? 1 : 0
  return `M 0 0 L ${x1.toFixed(5)} ${y1.toFixed(5)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(5)} ${y2.toFixed(5)} Z`
}

const legend = computed(() => props.slices.filter(s => s.percent > 0))

const segments = computed(() => {
  const list = legend.value
  if (!list.length) return []
  let angle = -Math.PI / 2
  return list.map((s, i) => {
    const frac = Math.max(0, s.percent) / 100
    const angleSize = frac * 2 * Math.PI
    const d = segmentPath(angle, angleSize)
    angle += angleSize
    const color = s.color?.trim() ? s.color : palette[i % palette.length]!
    return { d, color }
  })
})

const ariaLabel = computed(() => {
  const list = legend.value
  if (!list.length) return 'No screen-time data'
  return `Character screen share: ${list.map(s => `${s.label} ${s.percent.toFixed(1)} percent`).join(', ')}`
})
</script>
