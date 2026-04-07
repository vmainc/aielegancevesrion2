<template>
  <div class="landing-studio text-gray-900 antialiased bg-white">
    <!-- Hero -->
    <section class="relative overflow-hidden border-b border-gray-200">
      <div class="hero-gradient-light absolute inset-0 opacity-100" aria-hidden="true" />
      <div
        class="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(65,170,168,0.12),transparent)]"
        aria-hidden="true"
      />
      <div class="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 sm:pt-28 sm:pb-32">
        <p class="text-sm font-medium tracking-widest uppercase text-primary mb-4">
          Turn ideas or scripts into fully produced video using AI
        </p>
        <h1 class="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 mb-6 max-w-4xl leading-[1.1]">
          Build Films, Shorts, and Content with AI
        </h1>
        <p class="text-lg sm:text-xl text-gray-600 max-w-2xl mb-10 leading-relaxed">
          From concept to final video — AI Elegance helps you write, design, storyboard, and render your ideas into real content.
        </p>
        <div class="flex flex-col sm:flex-row gap-4">
          <NuxtLink
            to="/signup"
            class="inline-flex justify-center items-center px-8 py-3.5 rounded-xl bg-primary text-gray-950 font-semibold text-base hover:bg-primary/90 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/15"
          >
            Get started
          </NuxtLink>
          <NuxtLink
            :to="{ path: '/login', query: { redirect: '/projects' } }"
            class="inline-flex justify-center items-center px-8 py-3.5 rounded-xl border border-gray-300 text-gray-800 font-semibold text-base hover:bg-gray-50 hover:border-gray-400 transition-all"
          >
            Import script
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- What you can do -->
    <section id="capabilities" class="py-20 sm:py-28 border-b border-gray-200 bg-gray-50/50">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 text-center mb-4">
          Your creative studio, end to end
        </h2>
        <p class="text-gray-600 text-center max-w-xl mx-auto mb-14">
          One workflow from first spark to rendered shots — organized in projects, not scattered tools.
        </p>
        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <article
            v-for="card in capabilityCards"
            :key="card.title"
            class="group rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm hover:border-primary/30 hover:shadow-md transition-all duration-300"
          >
            <div class="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 text-primary group-hover:bg-primary/15 transition-colors">
              <svg
                v-if="card.icon === 'spark'"
                class="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              ><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
              <svg
                v-else-if="card.icon === 'users'"
                class="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              ><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              <svg
                v-else-if="card.icon === 'frame'"
                class="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              ><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <svg
                v-else-if="card.icon === 'film'"
                class="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              ><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>
              <svg
                v-else-if="card.icon === 'chart'"
                class="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              ><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            </div>
            <h3 class="text-xl font-semibold text-gray-900 mb-2">{{ card.title }}</h3>
            <p class="text-gray-600 text-sm leading-relaxed">{{ card.body }}</p>
          </article>
        </div>
      </div>
    </section>

    <!-- How it works -->
    <section id="how-it-works" class="py-20 sm:py-28 border-b border-gray-200 bg-white">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 text-center mb-16">
          How it works
        </h2>
        <ol class="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-4">
          <li
            v-for="(step, i) in steps"
            :key="step.title"
            class="relative flex flex-col items-center text-center lg:block lg:text-left"
          >
            <div class="flex items-center gap-4 mb-4 lg:mb-6 w-full lg:w-auto">
              <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary font-bold text-lg border border-primary/25">
                {{ i + 1 }}
              </span>
              <span class="hidden lg:block h-px flex-1 bg-gradient-to-r from-primary/40 to-transparent max-w-[80px]" aria-hidden="true" />
            </div>
            <h3 class="text-lg font-semibold text-gray-900 mb-2">{{ step.title }}</h3>
            <p class="text-sm text-gray-600 leading-relaxed">{{ step.detail }}</p>
          </li>
        </ol>
      </div>
    </section>

    <!-- Script import -->
    <section class="py-20 sm:py-28 border-b border-gray-200 bg-gray-50/50">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 via-white to-gray-50 p-8 sm:p-12 lg:p-14 flex flex-col lg:flex-row lg:items-center gap-10">
          <div class="flex-1">
            <p class="text-primary font-semibold text-sm uppercase tracking-wider mb-3">Screenplay import</p>
            <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Already have a script?
            </h2>
            <p class="text-gray-600 text-lg leading-relaxed mb-8">
              Upload your screenplay and instantly generate scenes, characters, and storyboard structure — ready for your AI filmmaking pipeline.
            </p>
            <NuxtLink
              :to="{ path: '/login', query: { redirect: '/projects' } }"
              class="inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-primary text-gray-950 font-semibold hover:bg-primary/90 transition-colors"
            >
              Import script
            </NuxtLink>
          </div>
          <div class="flex-1 flex justify-center lg:justify-end">
            <div class="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div class="flex items-center gap-2 text-xs text-gray-500 mb-4">
                <span class="h-2 w-2 rounded-full bg-emerald-500" />
                Final Draft · PDF · Plain text
              </div>
              <div class="space-y-2 font-mono text-xs text-gray-500">
                <div class="h-2 w-3/4 rounded bg-gray-200" />
                <div class="h-2 w-full rounded bg-gray-100" />
                <div class="h-2 w-5/6 rounded bg-gray-100" />
                <div class="h-2 w-2/3 rounded bg-gray-200" />
              </div>
              <div class="mt-6 pt-4 border-t border-gray-200 text-sm text-gray-500">
                → Scenes · Characters · Shots
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- AI comparison -->
    <section id="compare" class="py-20 sm:py-28 border-b border-gray-200 bg-white">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 text-center mb-4">
          Compare AI creativity
        </h2>
        <p class="text-gray-600 text-center max-w-2xl mx-auto mb-12">
          Generate concepts and drafts using multiple AI models side by side — pick the voice that fits your project.
        </p>
        <div class="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto">
          <div
            v-for="(mock, idx) in comparisonMocks"
            :key="idx"
            class="rounded-xl border border-gray-200 bg-gray-50/80 p-4 hover:border-primary/25 transition-colors"
          >
            <div class="text-xs font-semibold text-primary mb-2">{{ mock.model }}</div>
            <div class="h-2 w-16 rounded bg-gray-300 mb-3" />
            <p class="text-xs text-gray-600 leading-relaxed line-clamp-4">{{ mock.blurb }}</p>
          </div>
        </div>
        <p class="text-center mt-8 text-sm text-gray-500">
          Available inside your project workflow and the dedicated comparison workspace.
        </p>
      </div>
    </section>

    <!-- Workflow tree -->
    <section id="workflow" class="py-20 sm:py-28 border-b border-gray-200 bg-gray-50/50">
      <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
          Everything is organized into projects
        </h2>
        <p class="text-gray-600 mb-12">
          One home for your film — from first idea to rendered frames.
        </p>
        <div class="flex flex-col items-center gap-0 max-w-xs mx-auto">
          <template v-for="(node, i) in workflowNodes" :key="node">
            <div class="w-full px-6 py-3 rounded-xl border border-gray-200 bg-white font-medium text-gray-900 text-center shadow-sm">
              {{ node }}
            </div>
            <span v-if="i < workflowNodes.length - 1" class="text-gray-400 text-xl py-1 select-none" aria-hidden="true">↓</span>
          </template>
        </div>
      </div>
    </section>

    <!-- Final CTA -->
    <section class="py-20 sm:py-28 bg-white">
      <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-8">
          Start your first project
        </h2>
        <NuxtLink
          to="/signup"
          class="inline-flex items-center justify-center px-10 py-4 rounded-xl bg-primary text-gray-950 font-semibold text-lg hover:bg-primary/90 transition-all hover:scale-[1.02] shadow-xl shadow-primary/10"
        >
          Get started free
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
const capabilityCards: Array<{ title: string; body: string; icon: 'spark' | 'users' | 'frame' | 'film' | 'chart' }> = [
  { title: 'Concept & Story', body: 'Generate ideas, treatments, and scripts with AI.', icon: 'spark' },
  { title: 'Characters', body: 'Create consistent characters with personality and visual identity.', icon: 'users' },
  { title: 'Storyboard', body: 'Turn scenes into cinematic shots and visual prompts.', icon: 'frame' },
  { title: 'Video', body: 'Render shots and scenes into AI-generated video.', icon: 'film' },
  { title: 'Analysis', body: 'Refine tone, pacing, and story with intelligent feedback.', icon: 'chart' }
]

const steps = [
  { title: 'Start a project', detail: 'Name your film, set aspect ratio and goals.' },
  { title: 'Generate or import', detail: 'Brainstorm with AI or upload a finished script.' },
  { title: 'Scenes & shots', detail: 'Break the story into beats and visual prompts.' },
  { title: 'Visuals & video', detail: 'Generate imagery and motion from your storyboard.' }
]

const comparisonMocks = [
  { model: 'Model A', blurb: 'A neo-noir tone: rain-slick streets, moral ambiguity, and a protagonist who trusts the wrong ally…' },
  { model: 'Model B', blurb: 'Warm, documentary vérité — handheld intimacy, natural light, quiet moments between chaos…' },
  { model: 'Model C', blurb: 'High-concept sci-fi: sterile corridors, cold blues, and a reveal that reframes the entire…' }
]

const workflowNodes = ['Project', 'Story', 'Characters', 'Storyboard', 'Video', 'Analysis']

useHead({
  title: 'AI Elegance — AI filmmaking & content creation',
  meta: [
    {
      name: 'description',
      content:
        'Turn ideas or scripts into produced video. Write, storyboard, and render with AI — one unified creative workflow.'
    }
  ]
})
</script>

<style scoped>
.landing-studio {
  min-height: 100%;
}

.hero-gradient-light {
  background: linear-gradient(125deg, #f8fafc 0%, #f1f5f9 45%, #ecfdf5 75%, #f8fafc 100%);
  background-size: 200% 200%;
  animation: hero-shift-light 20s ease infinite;
}

@keyframes hero-shift-light {
  0%,
  100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}
</style>
