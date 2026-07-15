<script setup lang="ts">
import type { CreativeCharacter } from '~/types/creative-project'
import type { OverviewComparableCandidate, OverviewOmdbMovie } from '~/composables/useOverviewImportedInsights'

defineProps<{
  projectId: string
  threeActBreakdown: string
  canLoad: boolean
  candidates: OverviewComparableCandidate[]
  movies: OverviewOmdbMovie[]
  loadingMovies: boolean
  moviesError: string
  omdbConfigured: boolean | null
  moviesWarning: string
  characters: CreativeCharacter[]
  loadingCharacters: boolean
  charactersError: string
}>()

const emit = defineEmits<{
  'refresh-movies': []
  'refresh-characters': []
}>()
</script>

<template>
  <div>
    <div class="border-t border-gray-100 pt-6 mt-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-2">Three-act breakdown</h2>
      <p class="text-sm text-gray-600 mb-3">
        Structural map from your screenplay as written — not a new version of the story.
      </p>
      <pre
        v-if="threeActBreakdown"
        class="whitespace-pre-wrap font-sans text-gray-800 text-sm leading-relaxed rounded-lg border border-gray-200 bg-gray-50 p-4"
      >{{ threeActBreakdown }}</pre>
      <p v-else class="text-sm text-gray-500">
        No act breakdown stored yet. Run director analysis again from Overview after saving your screenplay.
      </p>
    </div>

    <div class="border-t border-gray-100 pt-6 mt-6">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h2 class="text-lg font-semibold text-gray-900">Comparable films</h2>
        <button
          v-if="canLoad"
          type="button"
          class="px-3 py-1.5 text-sm rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-900 disabled:opacity-50"
          :disabled="loadingMovies"
          @click="emit('refresh-movies')"
        >
          {{ loadingMovies ? 'Refreshing…' : 'Refresh' }}
        </button>
      </div>
      <p class="text-sm text-gray-600 mb-4">
        Posters and ratings from OMDb, using titles extracted from your treatment — mirrors Script Wizard.
      </p>
      <p
        v-if="!canLoad"
        class="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4"
      >
        Sign in with a cloud-saved project to load film metadata.
      </p>
      <div v-else-if="loadingMovies" class="py-4">
        <FilmReelLoader
          size="sm"
          label="Cueing comparable films"
          sub-label="Looking up titles from your analysis…"
        />
      </div>
      <p v-else-if="moviesError" class="text-sm text-red-700">{{ moviesError }}</p>
      <ul v-else-if="movies.length" class="grid sm:grid-cols-2 gap-4">
        <li
          v-for="m in movies"
          :key="m.imdbId || `${m.title}-${m.year}`"
          class="rounded-xl border border-gray-200 bg-gray-50 p-4"
        >
          <div class="flex gap-3">
            <img
              v-if="m.poster && m.poster !== 'N/A'"
              :src="m.poster"
              alt=""
              class="w-16 h-24 object-cover rounded border border-gray-200 shrink-0"
            >
            <div class="min-w-0">
              <p class="font-semibold text-gray-900 truncate">{{ m.title }}</p>
              <p class="text-xs text-gray-500 mb-1">{{ m.year || '—' }} · {{ m.genre || '—' }}</p>
              <p class="text-xs text-gray-600 line-clamp-2 mb-1">{{ m.plot || 'No plot from OMDb.' }}</p>
              <p class="text-xs text-gray-500">IMDb: {{ m.imdbRating || '—' }} · RT: {{ m.rottenTomatoes || '—' }}</p>
            </div>
          </div>
        </li>
      </ul>
      <p v-else class="text-sm text-gray-500">
        <template v-if="omdbConfigured === false">
          Comparable film posters use OMDb. Add <code class="text-xs bg-gray-100 px-1 rounded">OMDB_API_KEY</code> to the server environment, redeploy, then tap Refresh.
        </template>
        <template v-else-if="!candidates.length">
          No comparable titles were found in your treatment yet. Run director analysis again after saving your screenplay so the “Comparable films” block is filled in.
        </template>
        <template v-else-if="omdbConfigured === true">
          OMDb is configured, but no posters or ratings came back for the extracted titles. Check spelling/year, or try Refresh after a new analysis.
        </template>
        <template v-else>
          No posters or ratings yet. Set <code class="text-xs bg-gray-100 px-1 rounded">OMDB_API_KEY</code> on the server if you have not, redeploy, then Refresh; if the key is already set, run director analysis again and check the extracted titles below.
        </template>
      </p>
      <p v-if="moviesWarning" class="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
        {{ moviesWarning }}
      </p>
      <p v-if="candidates.length && !movies.length && !loadingMovies" class="text-xs text-gray-500 mt-3">
        Extracted titles: {{ candidates.map(c => c.title).join(', ') }}
      </p>
    </div>

    <div class="border-t border-gray-100 pt-6 mt-6">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h2 class="text-lg font-semibold text-gray-900">Characters from your screenplay</h2>
        <button
          v-if="canLoad"
          type="button"
          class="px-3 py-1.5 text-sm rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-900 disabled:opacity-50"
          :disabled="loadingCharacters"
          @click="emit('refresh-characters')"
        >
          {{ loadingCharacters ? 'Refreshing…' : 'Refresh' }}
        </button>
      </div>
      <p class="text-sm text-gray-600 mb-4">
        Each row is a speaking or named role from your uploaded script, with a short description produced by the same AI import that built your synopsis and treatment.
      </p>
      <p
        v-if="!canLoad"
        class="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4"
      >
        Sign in with a cloud-saved project to load the character table.
      </p>
      <ProjectCharactersDescriptionTable
        v-else
        :characters="characters"
        :loading="loadingCharacters"
        :error="charactersError || null"
        heading="Cast"
        subheading="Use Characters → “Build / refresh cast from script” after director analysis; descriptions follow your latest synopsis, treatment, and Director-tab notes."
        empty-hint="No cast rows loaded yet. Open Characters and run “Build / refresh cast from script” (or add rows manually)."
        aria-label="Characters from imported screenplay"
      />
      <p class="text-sm text-gray-500 mt-4">
        <NuxtLink
          :to="`/projects/${projectId}/characters`"
          class="text-primary font-medium hover:underline"
        >
          Open full Characters step
        </NuxtLink>
        for screen-share chart and asset links.
      </p>
    </div>
  </div>
</template>
