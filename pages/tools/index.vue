<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
    <div class="mb-10">
      <h1 class="font-display text-3xl sm:text-4xl text-ivory tracking-wide mb-2">Tools</h1>
      <p class="text-gray-600 text-sm sm:text-base max-w-2xl">
        Creative utilities powered by AI—video, music, character imagery, and more.
      </p>
    </div>

    <ul class="grid gap-4 sm:grid-cols-2">
      <li v-for="card in cards" :key="card.to">
        <NuxtLink
          :to="card.to"
          class="block rounded-xl border border-gray-200 bg-studio-slate shadow-sm hover:border-primary/50 hover:bg-gray-50 transition-all p-6 h-full"
        >
          <h2 class="text-lg font-semibold text-gray-900 mb-2">{{ card.title }}</h2>
          <p class="text-sm text-gray-600 mb-4">{{ card.blurb }}</p>
          <span class="text-sm text-primary font-medium">Open →</span>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>

<script setup>
const cards = [
  {
    to: '/tools/video-generation',
    title: 'Video generation',
    blurb: 'Generate AI video clips with OpenRouter — upload a starting frame, pick models, save to projects.',
  },
  {
    to: '/tools/music-generation',
    title: 'Music generation',
    blurb: 'Compose score beds and themes with Google Lyria and save them to projects.',
  },
  {
    to: '/tools/script-wizard',
    title: 'Script Wizard',
    blurb: 'Standalone script workspace: upload, analyze, and reuse scripts across projects.',
  },
  {
    to: '/tools/storyboard-builder',
    title: 'Storyboard Builder',
    blurb: 'Build a scene board-by-board — starts with one panel, add more as you go.',
  },
  {
    to: '/tools/speech-to-text',
    title: 'Speech to Text',
    blurb: 'Upload an audio recording and turn it into editable text.',
  },
  {
    to: '/adapt-to-film',
    title: 'Adapt to Film',
    blurb: 'Turn a transcript, story, or article into a treatment, scenes, shots, and production plan.',
  },
  {
    to: '/character-creator',
    title: 'Character Creator',
    blurb: 'Generate character portraits and references with image models.',
  },
]

useHead({
  title: 'Tools',
})
</script>
