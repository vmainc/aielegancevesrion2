<template>
  <div class="landing-studio text-ivory antialiased bg-studio-charcoal">
    <!-- Hero -->
    <section class="relative overflow-hidden border-b border-white/10">
      <div class="hero-cinematic absolute inset-0" aria-hidden="true" />
      <div
        class="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_-10%,rgba(212,160,23,0.16),transparent_60%)]"
        aria-hidden="true"
      />
      <div class="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 sm:pt-28 sm:pb-32">
        <p class="text-sm font-medium tracking-[0.28em] uppercase text-primary mb-5">
          A virtual movie studio for creators, by creators
        </p>
        <h1 class="font-display text-6xl sm:text-7xl lg:text-8xl text-ivory mb-6 max-w-4xl leading-[0.95]">
          Make the movie.
        </h1>
        <p class="text-lg sm:text-xl text-smoke max-w-2xl mb-10 leading-relaxed">
          Everything you need to take a story from idea to screen.
        </p>
        <div class="flex flex-col sm:flex-row gap-4">
          <NuxtLink
            to="/login"
            class="inline-flex justify-center items-center px-8 py-3.5 rounded-lg bg-primary text-charcoal font-semibold text-base hover:bg-primary/90 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/20"
          >
            Sign in
          </NuxtLink>
          <NuxtLink
            :to="{ path: '/login', query: { redirect: '/guide' } }"
            class="inline-flex justify-center items-center px-8 py-3.5 rounded-lg border border-primary/40 text-ivory font-semibold text-base hover:bg-studio-slate hover:border-primary transition-all"
          >
            Import script
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- What you can do -->
    <section id="capabilities" class="py-20 sm:py-28 border-b border-white/10 bg-studio-charcoal">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 class="font-display text-4xl sm:text-5xl text-ivory text-center mb-3">
          Your studio, end to end
        </h2>
        <div class="gold-rule w-40 mx-auto mb-6" />
        <p class="text-smoke text-center max-w-xl mx-auto mb-14">
          One workflow from first spark to final cut — organized in projects, not scattered tools.
        </p>
        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <article
            v-for="card in capabilityCards"
            :key="card.title"
            class="group rounded-2xl border border-white/10 bg-studio-slate p-6 sm:p-8 hover:border-primary/40 transition-all duration-300"
          >
            <div class="w-12 h-12 rounded-xl border border-primary/30 bg-primary/10 flex items-center justify-center mb-5 text-primary group-hover:bg-primary/15 transition-colors">
              <svg
                v-if="card.icon === 'story'"
                class="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              ><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 4h8l5 5v11a1 1 0 01-1 1H7a1 1 0 01-1-1V5a1 1 0 011-1z M15 4v5h5" /></svg>
              <svg
                v-else-if="card.icon === 'users'"
                class="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              ><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              <svg
                v-else-if="card.icon === 'shots'"
                class="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              ><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 8V5a2 2 0 012-2h3M16 3h3a2 2 0 012 2v3M21 16v3a2 2 0 01-2 2h-3M8 21H5a2 2 0 01-2-2v-3" /></svg>
              <svg
                v-else-if="card.icon === 'edit'"
                class="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              ><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14.121 14.121L19 19m-7-4a6 6 0 01-6-6V5l6 3 6-3v4a6 6 0 01-6 6z" /></svg>
              <svg
                v-else-if="card.icon === 'sound'"
                class="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              ><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" /></svg>
              <svg
                v-else-if="card.icon === 'final'"
                class="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              ><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z M10 9l6 3-6 3V9z" /></svg>
            </div>
            <h3 class="font-display text-2xl text-ivory mb-2 tracking-wide">{{ card.title }}</h3>
            <p class="text-smoke text-sm leading-relaxed">{{ card.body }}</p>
          </article>
        </div>
      </div>
    </section>

    <!-- How it works -->
    <section id="how-it-works" class="py-20 sm:py-28 border-b border-white/10 bg-studio-slate">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 class="font-display text-4xl sm:text-5xl text-ivory text-center mb-3">
          How it works
        </h2>
        <div class="gold-rule w-40 mx-auto mb-16" />
        <ol class="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-4">
          <li
            v-for="(step, i) in steps"
            :key="step.title"
            class="relative flex flex-col items-center text-center lg:block lg:text-left"
          >
            <div class="flex items-center gap-4 mb-4 lg:mb-6 w-full lg:w-auto">
              <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary font-display text-xl border border-primary/30">
                {{ i + 1 }}
              </span>
              <span class="hidden lg:block h-px flex-1 bg-gradient-to-r from-primary/50 to-transparent max-w-[80px]" aria-hidden="true" />
            </div>
            <h3 class="text-lg font-semibold text-ivory mb-2">{{ step.title }}</h3>
            <p class="text-sm text-smoke leading-relaxed">{{ step.detail }}</p>
          </li>
        </ol>
      </div>
    </section>

    <!-- Script import -->
    <section class="py-20 sm:py-28 border-b border-white/10 bg-studio-charcoal">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/10 via-studio-slate to-studio-charcoal p-8 sm:p-12 lg:p-14 flex flex-col lg:flex-row lg:items-center gap-10">
          <div class="flex-1">
            <p class="text-primary font-semibold text-sm uppercase tracking-[0.2em] mb-3">Screenplay import</p>
            <h2 class="font-display text-4xl sm:text-5xl text-ivory mb-4">
              Already have a script?
            </h2>
            <p class="text-smoke text-lg leading-relaxed mb-8">
              Upload your screenplay and instantly generate scenes, characters, and storyboard structure — ready for your filmmaking pipeline.
            </p>
            <NuxtLink
              :to="{ path: '/login', query: { redirect: '/guide' } }"
              class="inline-flex items-center justify-center px-8 py-3.5 rounded-lg bg-primary text-charcoal font-semibold hover:bg-primary/90 transition-colors"
            >
              Import script
            </NuxtLink>
          </div>
          <div class="flex-1 flex justify-center lg:justify-end">
            <div class="w-full max-w-sm rounded-2xl border border-white/10 bg-studio-charcoal p-6">
              <div class="flex items-center gap-2 text-xs text-smoke mb-4">
                <span class="h-2 w-2 rounded-full bg-primary" />
                Final Draft · PDF · Plain text
              </div>
              <div class="space-y-2 font-mono text-xs text-smoke">
                <div class="h-2 w-3/4 rounded bg-white/10" />
                <div class="h-2 w-full rounded bg-white/5" />
                <div class="h-2 w-5/6 rounded bg-white/5" />
                <div class="h-2 w-2/3 rounded bg-white/10" />
              </div>
              <div class="mt-6 pt-4 border-t border-white/10 text-sm text-smoke">
                → Scenes · Characters · Shots
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- AI comparison -->
    <section id="compare" class="py-20 sm:py-28 border-b border-white/10 bg-studio-slate">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 class="font-display text-4xl sm:text-5xl text-ivory text-center mb-3">
          Compare AI creativity
        </h2>
        <div class="gold-rule w-40 mx-auto mb-6" />
        <p class="text-smoke text-center max-w-2xl mx-auto mb-12">
          Generate concepts and drafts using multiple AI models side by side — pick the voice that fits your project.
        </p>
        <div class="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto">
          <div
            v-for="(mock, idx) in comparisonMocks"
            :key="idx"
            class="rounded-xl border border-white/10 bg-studio-charcoal p-4 hover:border-primary/40 transition-colors"
          >
            <div class="text-xs font-semibold text-primary mb-2 tracking-wide uppercase">{{ mock.model }}</div>
            <div class="h-2 w-16 rounded bg-primary/40 mb-3" />
            <p class="text-xs text-smoke leading-relaxed line-clamp-4">{{ mock.blurb }}</p>
          </div>
        </div>
        <p class="text-center mt-8 text-sm text-smoke">
          Available inside your project workflow and the dedicated comparison workspace.
        </p>
      </div>
    </section>

    <!-- Workflow tree -->
    <section id="workflow" class="py-20 sm:py-28 border-b border-white/10 bg-studio-charcoal">
      <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 class="font-display text-4xl sm:text-5xl text-ivory mb-3">
          Everything is organized into projects
        </h2>
        <div class="gold-rule w-40 mx-auto mb-6" />
        <p class="text-smoke mb-12">
          One home for your film — from first idea to rendered frames.
        </p>
        <div class="flex flex-col items-center gap-0 max-w-xs mx-auto">
          <template v-for="(node, i) in workflowNodes" :key="node">
            <div class="w-full px-6 py-3 rounded-lg border border-white/10 bg-studio-slate font-medium text-ivory text-center tracking-wide">
              {{ node }}
            </div>
            <span v-if="i < workflowNodes.length - 1" class="text-primary text-xl py-1 select-none" aria-hidden="true">↓</span>
          </template>
        </div>
      </div>
    </section>

    <!-- Final CTA -->
    <section class="py-20 sm:py-28 bg-studio-slate">
      <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 class="font-display text-4xl sm:text-5xl text-ivory mb-4">
          Start your first project
        </h2>
        <p class="text-smoke mb-8">Make the movie.</p>
        <NuxtLink
          to="/login"
          class="inline-flex items-center justify-center px-10 py-4 rounded-lg bg-primary text-charcoal font-semibold text-lg hover:bg-primary/90 transition-all hover:scale-[1.02] shadow-xl shadow-primary/20"
        >
          Sign in
        </NuxtLink>
      </div>
    </section>

    <footer class="border-t border-primary/25 bg-studio-charcoal">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
        <p class="font-display text-xl text-ivory tracking-wide">Make the movie.</p>
        <p class="text-xs tracking-[0.22em] uppercase text-primary">aifilmstud.io</p>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { DEFAULT_AUTHENTICATED_PATH } from '~/lib/default-authenticated-path'

const { isAuthenticated, initAuth } = useAuth()

onMounted(async () => {
  await initAuth()
  if (isAuthenticated.value) {
    await navigateTo(DEFAULT_AUTHENTICATED_PATH, { replace: true })
  }
})

const capabilityCards: Array<{ title: string; body: string; icon: 'story' | 'users' | 'shots' | 'edit' | 'sound' | 'final' }> = [
  { title: 'Story', body: 'Generate ideas, treatments, and scripts with AI.', icon: 'story' },
  { title: 'Characters', body: 'Create consistent characters with personality and visual identity.', icon: 'users' },
  { title: 'Shots', body: 'Turn scenes into cinematic shots and visual prompts.', icon: 'shots' },
  { title: 'Edit', body: 'Assemble boards, scenes, and clips into a coherent cut.', icon: 'edit' },
  { title: 'Sound', body: 'Generate music and speech to score the picture.', icon: 'sound' },
  { title: 'Final Cut', body: 'Render shots into finished video, ready to share.', icon: 'final' }
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

const workflowNodes = ['Story', 'Characters', 'Shots', 'Edit', 'Sound', 'Final Cut']

useHead({
  title: 'AI Film Studio — Make the movie.',
  meta: [
    {
      name: 'description',
      content:
        'AI Film Studio is a virtual movie studio for creators, by creators. Everything you need to take a story from idea to screen.'
    }
  ]
})
</script>

<style scoped>
.landing-studio {
  min-height: 100%;
}

.hero-cinematic {
  background: radial-gradient(ellipse 80% 60% at 20% 20%, rgba(212, 160, 23, 0.08), transparent 50%),
    linear-gradient(165deg, #0D0D0F 0%, #1A1A1D 45%, #0D0D0F 100%);
}
</style>
