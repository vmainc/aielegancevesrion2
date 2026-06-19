<template>
  <svg
    class="inline-block shrink-0"
    :class="props.class"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
  <!-- Utility-knife / razorblade -->
    <path
      d="M3 17.5 19.5 4.5"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
    />
    <path
      d="M2.5 16.2 8.8 18.6 8.1 20.4 1.8 18Z"
      fill="currentColor"
      stroke="currentColor"
      stroke-width="0.5"
      stroke-linejoin="round"
    />
    <circle cx="19.8" cy="4.7" r="1.35" fill="currentColor" />
  </svg>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    class?: string
  }>(),
  { class: 'w-3.5 h-3.5' }
)
</script>
