<template>
  <div class="max-w-3xl">
    <p v-if="!scriptUploadedAwaitingAnalyze" class="text-sm text-gray-500 mb-6">
      <span class="text-primary font-medium">{{ stepBadge || 'Step —' }}</span>
      <template v-if="scratchWorkflow && !hasConcept">
        · Describe your idea, set target runtime, compare AI models, then pick a story and open Director.
      </template>
      <template v-else-if="scratchWorkflow">
        · Your synopsis lives here; refine the director bible on the Director tab, then build cast and storyboard when ready.
      </template>
      <template v-else>
        · Your synopsis lives here; director bible and continuity are on the Director tab.
      </template>
    </p>

    <p
      v-if="isLocalProject"
      class="mb-8 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3"
    >
      This project is saved on this device only. Sign in and create a project from
      <NuxtLink to="/projects" class="font-medium text-primary hover:underline">Projects</NuxtLink>
      to sync with your account.
    </p>

    <template v-if="scriptUploadedAwaitingAnalyze">
      <p class="text-sm text-gray-600 mb-6">
        <span class="text-primary font-medium">{{ stepBadge || 'Step —' }}</span>
        · Screenplay saved — run director analysis below when you are ready.
      </p>
      <section class="rounded-xl border-2 border-primary/40 bg-gradient-to-b from-primary/10 to-white shadow-sm p-6 sm:p-10 mb-8">
        <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight mb-3">
          {{ project?.name }}
        </h1>
        <p class="text-base text-gray-700 mb-6 max-w-xl leading-relaxed">
          Your screenplay is saved. <span class="font-semibold text-gray-900">Import script</span> reads the file, builds scenes and cast, seeds storyboard panels, and sets up director notes — then generate video from the Storyboard step.
        </p>
        <button
          type="button"
          class="px-5 py-3 bg-primary hover:bg-primary/90 text-gray-950 rounded-xl text-base font-semibold transition-colors disabled:opacity-50"
          :disabled="overviewFullImporting || !scriptWorkflowAssetId"
          @click="runProjectFullImport"
        >
          {{ overviewFullImporting ? 'Importing script…' : 'Import script into project' }}
        </button>
        <p v-if="overviewImportError" class="mt-3 text-sm text-red-700">{{ overviewImportError }}</p>
        <div
          v-if="overviewFullImporting"
          class="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-6"
        >
          <FilmReelLoader
            size="sm"
            label="Importing screenplay"
            sub-label="Synopsis, treatment, director bible, scenes, cast, and storyboard panels — this can take several minutes."
          />
        </div>
      </section>
    </template>

    <section
      v-else-if="hasConcept"
      class="rounded-xl border border-gray-200 bg-white shadow-sm p-6 sm:p-8 mb-10"
    >
      <div
        v-if="screenplayWorkflowEnabled && canCloudImport && hasWorkflowScreenplaySaved"
        class="mb-6 rounded-xl border-2 border-primary/40 bg-primary/10 p-4 sm:p-5"
      >
        <p class="text-xs font-bold uppercase tracking-wide text-primary mb-2">
          Screenplay ready
        </p>
        <p class="text-sm text-gray-700 mb-3">
          Run analysis for a cold read of your saved screenplay — synopsis, tone, three-act map, and director notes faithful to what you wrote (no invented story beats).
        </p>
        <div class="mt-5 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <p class="text-sm font-semibold text-gray-900 mb-2">Choose your guide/director model</p>
          <p class="text-xs text-gray-600 mb-3">
            Pick one or more models, compare outputs, then choose which one should guide this project.
          </p>
          <div class="flex flex-wrap gap-3 mb-4">
            <label
              v-for="m in modelOptions"
              :key="`analyze-ready-${m.id}`"
              class="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white cursor-pointer hover:border-primary/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <input
                v-model="selectedAnalysisModelIds"
                type="checkbox"
                :value="m.id"
                class="rounded border-gray-300 text-primary focus:ring-primary"
              >
              <span class="text-sm text-gray-800">{{ m.label }}</span>
            </label>
          </div>
          <button
            type="button"
            class="px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            :disabled="overviewPreviewing || overviewAnalyzing || !selectedAnalysisModelIds.length"
            @click="previewScriptAnalyses"
          >
            {{ overviewPreviewing ? 'Analyzing script…' : 'Analyze script' }}
          </button>
        </div>
        <div
          v-if="overviewAnalyzing"
          class="mt-4 rounded-xl border border-primary/20 bg-white/70 p-5"
        >
          <FilmReelLoader
            size="sm"
            label="Analyzing script"
            sub-label="Reading your screenplay — synopsis, observations, three-act map, director notes…"
          />
        </div>
        <div v-if="analysisCandidates.length" class="mt-5 grid gap-4">
          <article
            v-for="c in analysisCandidates"
            :key="`ready-candidate-${c.modelId}`"
            class="rounded-xl border border-gray-200 bg-white p-4"
          >
            <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
              <p class="text-sm font-semibold text-gray-900">{{ c.label }}</p>
              <button
                v-if="!c.error"
                type="button"
                class="px-3 py-1.5 bg-primary hover:bg-primary/90 text-gray-950 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                :disabled="overviewAnalyzing"
                @click="applyCandidateModel(c.modelId)"
              >
                Use this analysis
              </button>
            </div>
            <p v-if="c.error" class="text-sm text-red-700">{{ c.error }}</p>
            <template v-else>
              <p class="text-xs text-gray-500 mb-2">{{ c.genre || '—' }} · {{ c.tone || '—' }}</p>
              <p class="text-sm text-gray-700 whitespace-pre-wrap">{{ c.synopsis || 'No synopsis returned.' }}</p>
            </template>
          </article>
        </div>
      </div>
      <p class="text-xs font-semibold uppercase tracking-wide text-primary mb-3">Synopsis</p>
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight mb-6">
        {{ project?.name }}
      </h1>
      <div
        v-if="project?.genre || project?.tone || (project?.themes && project.themes.length)"
        class="flex flex-wrap gap-2 mb-6"
      >
        <span v-if="project?.genre" class="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-800 capitalize">{{ project.genre }}</span>
        <span v-if="project?.tone" class="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">{{ project.tone }}</span>
        <span
          v-for="t in (project?.themes ?? [])"
          :key="t"
          class="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-600"
        >{{ t }}</span>
      </div>
      <div
        class="text-gray-800 text-base sm:text-lg leading-relaxed whitespace-pre-wrap border-t border-gray-100 pt-6"
      >
        {{ conceptSynopsisDisplay }}
      </div>

      <template v-if="showImportedScriptOverview">
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
              v-if="canLoadImportedMovies"
              type="button"
              class="px-3 py-1.5 text-sm rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-900 disabled:opacity-50"
              :disabled="loadingOverviewMovies"
              @click="loadOverviewMovies"
            >
              {{ loadingOverviewMovies ? 'Refreshing…' : 'Refresh' }}
            </button>
          </div>
          <p class="text-sm text-gray-600 mb-4">
            Posters and ratings from OMDb, using titles extracted from your treatment — mirrors Script Wizard.
          </p>
          <p
            v-if="!canLoadImportedMovies"
            class="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4"
          >
            Sign in with a cloud-saved project to load film metadata.
          </p>
          <div v-else-if="loadingOverviewMovies" class="py-4">
            <FilmReelLoader
              size="sm"
              label="Cueing comparable films"
              sub-label="Looking up titles from your analysis…"
            />
          </div>
          <p v-else-if="overviewMoviesError" class="text-sm text-red-700">{{ overviewMoviesError }}</p>
          <ul v-else-if="overviewMovies.length" class="grid sm:grid-cols-2 gap-4">
            <li
              v-for="m in overviewMovies"
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
            <template v-if="overviewOmdbConfigured === false">
              Comparable film posters use OMDb. Add <code class="text-xs bg-gray-100 px-1 rounded">OMDB_API_KEY</code> to the server environment, redeploy, then tap Refresh.
            </template>
            <template v-else-if="!overviewCandidates.length">
              No comparable titles were found in your treatment yet. Run director analysis again after saving your screenplay so the “Comparable films” block is filled in.
            </template>
            <template v-else-if="overviewOmdbConfigured === true">
              OMDb is configured, but no posters or ratings came back for the extracted titles. Check spelling/year, or try Refresh after a new analysis.
            </template>
            <template v-else>
              No posters or ratings yet. Set <code class="text-xs bg-gray-100 px-1 rounded">OMDB_API_KEY</code> on the server if you have not, redeploy, then Refresh; if the key is already set, run director analysis again and check the extracted titles below.
            </template>
          </p>
          <p v-if="overviewMoviesWarning" class="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
            {{ overviewMoviesWarning }}
          </p>
          <p v-if="overviewCandidates.length && !overviewMovies.length && !loadingOverviewMovies" class="text-xs text-gray-500 mt-3">
            Extracted titles: {{ overviewCandidates.map(c => c.title).join(', ') }}
          </p>
        </div>

        <div class="border-t border-gray-100 pt-6 mt-6">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-2">
            <h2 class="text-lg font-semibold text-gray-900">Characters from your screenplay</h2>
            <button
              v-if="canLoadImportedMovies"
              type="button"
              class="px-3 py-1.5 text-sm rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-900 disabled:opacity-50"
              :disabled="loadingOverviewCharacters"
              @click="loadOverviewCharacters"
            >
              {{ loadingOverviewCharacters ? 'Refreshing…' : 'Refresh' }}
            </button>
          </div>
          <p class="text-sm text-gray-600 mb-4">
            Each row is a speaking or named role from your uploaded script, with a short description produced by the same AI import that built your synopsis and treatment.
          </p>
          <p
            v-if="!canLoadImportedMovies"
            class="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4"
          >
            Sign in with a cloud-saved project to load the character table.
          </p>
          <ProjectCharactersDescriptionTable
            v-else
            :characters="overviewCharacters"
            :loading="loadingOverviewCharacters"
            :error="overviewCharactersError || null"
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

        <p class="text-sm text-gray-500 mt-6 pt-6 border-t border-gray-100">
          <template v-if="showImportedScriptOverview">
            Synopsis and treatment came from your screenplay import — the Story step is skipped in the sidebar. Continue with
            <NuxtLink :to="`/projects/${projectId}/characters`" class="text-primary font-medium hover:underline">Characters</NuxtLink>.
          </template>
          <template v-else>
            Full treatment text and AI regeneration:
            <NuxtLink :to="`/projects/${projectId}/story`" class="text-primary font-medium hover:underline">Story</NuxtLink>
          </template>
        </p>
      </template>
    </section>

    <!-- Screenplay upload lives here only until a file is saved; then the focused block above or Assets handles replacement. -->
    <ProjectOverviewScriptImportPanel
      v-if="screenplayWorkflowEnabled && canCloudImport && hasConcept && !showGeneratorForm && !scriptUploadedAwaitingAnalyze && !hasWorkflowScreenplaySaved"
      v-model:aspect="overviewAspect"
      v-model:goal="overviewGoal"
      :show-aspect-goal="false"
      :importing="overviewImporting"
      :analyzing="overviewAnalyzing"
      :analyze-enabled="Boolean(scriptWorkflowAssetId)"
      :prominent-analyze="highlightRunTreatmentImport"
      :error="overviewImportError"
      :has-file="Boolean(overviewImportFile)"
      heading="Screenplay"
      @file-change="onOverviewImportFile"
      @import-click="importScriptFromOverview"
      @analyze-click="runDefaultScriptAnalyze"
    />

    <!-- Saved concept: actions (generator hidden until they choose "different AI") -->
    <div
      v-if="hasConcept && !showGeneratorForm && !scriptUploadedAwaitingAnalyze"
      class="rounded-xl border border-primary/30 bg-primary/5 p-5 sm:p-6 mb-8"
    >
      <h2 class="text-lg font-semibold text-gray-900 mb-1">
        {{ scratchWorkflow ? 'Story saved' : 'Concept saved' }}
      </h2>
      <p class="text-sm text-gray-600 mb-4">
        <template v-if="scratchWorkflow && showConceptBootstrapCta">
          Build your screenplay, director bible, cast, scenes, and storyboard shot lists (with continuity prompts) from this story.
        </template>
        <template v-else>
          {{ scratchWorkflow
            ? 'Generate more ideas with other models, or remove this story to start fresh.'
            : 'Try other models or remove this concept to start fresh.' }}
        </template>
      </p>
      <div
        v-if="conceptBootstrapRunning"
        class="mb-4 rounded-xl border border-primary/20 bg-white p-5"
      >
        <FilmReelLoader
          size="sm"
          label="Building your project"
          sub-label="Runs in the background — screenplay, director, cast, scenes, and storyboard panels."
        />
      </div>
      <p v-if="conceptBootstrapError" class="text-sm text-red-700 mb-3">{{ conceptBootstrapError }}</p>
      <div class="flex flex-wrap gap-2">
        <button
          v-if="showConceptBootstrapCta"
          type="button"
          class="px-4 py-2 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg text-sm transition-colors disabled:opacity-45"
          :disabled="conceptBootstrapRunning"
          @click="runConceptBootstrap()"
        >
          {{ conceptBootstrapRunning ? 'Building…' : 'Build cast, scenes & storyboard' }}
        </button>
        <button
          type="button"
          class="px-4 py-2 border border-gray-200 text-gray-800 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors"
          @click="openGeneratorAgain"
        >
          Generate with different AI
        </button>
        <button
          type="button"
          class="px-4 py-2 border border-red-200 text-red-800 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
          :disabled="deletingConcept"
          @click="deleteConcept"
        >
          {{ deletingConcept ? 'Removing…' : 'Delete concept' }}
        </button>
      </div>
    </div>

    <StoryIdeaGeneratorPanel
      v-if="showScratchIdeaGenerator"
      ref="scratchIdeaPanelRef"
      class="mb-8"
      :project-id="projectId"
      :goal="project?.goal || 'film'"
      :aspect-ratio="project?.aspectRatio || '16:9'"
      :heading="hasConcept ? 'Compare new story ideas' : 'Generate story ideas'"
      :subheading="hasConcept
        ? 'Your saved story stays below until you pick a new idea.'
        : 'Describe your idea, set target runtime, compare AI models, then save one and continue to Director.'"
      :show-cancel="hasConcept"
      apply-label="Use this story"
      :generate-button-label="generateIdeasButtonLabel"
      @apply="onScratchIdeaApply"
      @cancel="cancelGeneratorPanel"
    />

    <!-- Screenplay import (import workflow) -->
    <section
      v-if="showImportWorkflowOverview"
      class="rounded-xl border border-gray-200 bg-gray-50 p-6 sm:p-8 mb-8"
    >
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
        <div>
          <h2 class="text-lg font-semibold text-gray-900 mb-1">
            <template v-if="hasWorkflowScreenplaySaved">
              Screenplay saved
            </template>
            <template v-else>
              {{ hasConcept ? 'Compare new AI concepts' : 'Import your screenplay' }}
            </template>
          </h2>
          <p class="text-sm text-gray-500">
            <template v-if="hasWorkflowScreenplaySaved">
              A screenplay is already saved for this project. Close this panel to use <span class="font-medium text-gray-800">Run director analysis</span> on Overview, or replace the file under
              <NuxtLink :to="withProjectQuery('/assets/scripts')" class="font-medium text-primary hover:underline">Assets → Scripts</NuxtLink>.
              Prompt-based concept generation stays hidden while a script file is on this project.
            </template>
            <template v-else>
              {{
                hasConcept
                  ? 'Your saved concept stays below until you pick a new one.'
                  : 'Upload your screenplay below, then pick models and run Analyze script when you are ready.'
              }}
            </template>
          </p>
          <div
            v-if="hasWorkflowScreenplaySaved && canCloudImport"
            class="mt-4"
          >
            <div class="mt-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
              <p class="text-sm font-semibold text-gray-900 mb-2">Choose your guide/director model</p>
              <p class="text-xs text-gray-600 mb-3">
                Pick one or more models, compare outputs, then choose which one should guide this project.
              </p>
              <div class="flex flex-wrap gap-3 mb-4">
                <label
                  v-for="m in modelOptions"
                  :key="`analyze-generator-${m.id}`"
                  class="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white cursor-pointer hover:border-primary/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <input
                    v-model="selectedAnalysisModelIds"
                    type="checkbox"
                    :value="m.id"
                    class="rounded border-gray-300 text-primary focus:ring-primary"
                  >
                  <span class="text-sm text-gray-800">{{ m.label }}</span>
                </label>
              </div>
              <button
                type="button"
                class="px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                :disabled="overviewPreviewing || overviewAnalyzing || !selectedAnalysisModelIds.length"
                @click="previewScriptAnalyses"
              >
                {{ overviewPreviewing ? 'Analyzing script…' : 'Analyze script' }}
              </button>
              <div
                v-if="overviewPreviewing || overviewAnalyzing"
                class="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-5"
              >
                <FilmReelLoader
                  size="sm"
                  :label="overviewPreviewing ? 'Comparing script analyses' : 'Analyzing script'"
                  :sub-label="overviewPreviewing
                    ? 'Running selected models in parallel and preparing synopsis options…'
                    : 'Applying your selected model to build synopsis, treatment, and director notes…'"
                />
              </div>
              <div v-if="analysisCandidates.length" class="mt-4 grid gap-3">
                <article
                  v-for="c in analysisCandidates"
                  :key="`generator-candidate-${c.modelId}`"
                  class="rounded-xl border border-gray-200 bg-white p-4"
                >
                  <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <p class="text-sm font-semibold text-gray-900">{{ c.label }}</p>
                    <button
                      v-if="!c.error"
                      type="button"
                      class="px-3 py-1.5 bg-primary hover:bg-primary/90 text-gray-950 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                      :disabled="overviewAnalyzing"
                      @click="applyCandidateModel(c.modelId)"
                    >
                      Use this analysis
                    </button>
                  </div>
                  <p v-if="c.error" class="text-sm text-red-700">{{ c.error }}</p>
                  <template v-else>
                    <p class="text-xs text-gray-500 mb-2">{{ c.genre || '—' }} · {{ c.tone || '—' }}</p>
                    <p class="text-sm text-gray-700 whitespace-pre-wrap">{{ c.synopsis || 'No synopsis returned.' }}</p>
                  </template>
                </article>
              </div>
            </div>
          </div>
        </div>
        <button
          v-if="hasConcept"
          type="button"
          class="shrink-0 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-white transition-colors"
          @click="cancelGeneratorPanel"
        >
          Cancel
        </button>
      </div>

      <ClientOnly>
        <p
          v-if="!isAuthenticated && canCloudImport"
          class="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4"
        >
          Log in to import a screenplay and run analysis.
        </p>
      </ClientOnly>

      <ProjectOverviewScriptImportPanel
        v-if="screenplayWorkflowEnabled && canCloudImport && !hasWorkflowScreenplaySaved"
        v-model:aspect="overviewAspect"
        v-model:goal="overviewGoal"
        :show-aspect-goal="false"
        :importing="overviewImporting"
        :analyzing="overviewAnalyzing"
        :analyze-enabled="Boolean(scriptWorkflowAssetId)"
        :prominent-analyze="highlightRunTreatmentImport"
        :error="overviewImportError"
        :has-file="Boolean(overviewImportFile)"
        heading="Import a screenplay"
        @file-change="onOverviewImportFile"
        @import-click="importScriptFromOverview"
        @analyze-click="runDefaultScriptAnalyze"
      />
      <ClientOnly>
        <p
          v-if="isAuthenticated && !canCloudImport"
          class="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4"
        >
          Sign in and use a project from
          <NuxtLink to="/projects" class="font-medium text-primary hover:underline">Projects</NuxtLink>
          to import a screenplay into this workspace.
        </p>
      </ClientOnly>

      <!-- duplicate scratch UI removed (see showScratchIdeaGenerator section above) -->
      <template v-if="false">
        <div v-if="modelsLoadError" class="text-sm text-red-700 mb-4">
          {{ modelsLoadError }}
        </div>

        <p
          v-if="canCloudImport"
          class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3"
        >
          Generate from a prompt
        </p>
        <div class="flex justify-between items-center gap-2 mb-2">
          <label class="text-sm font-medium text-gray-700">Your idea</label>
          <PromptEnhanceButton v-model="conceptPrompt" context="concept" />
        </div>
        <textarea
          ref="promptTextareaRef"
          v-model="conceptPrompt"
          rows="4"
          class="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary resize-y mb-5"
          placeholder="Describe your idea..."
          :disabled="generating"
        ></textarea>

        <fieldset class="mb-5" :disabled="generating || !(modelOptions?.length)">
          <legend class="text-sm font-medium text-gray-700 mb-2">Models</legend>
          <p class="text-xs text-gray-500 mb-3">Select one or more; requests run in parallel.</p>
          <div class="flex flex-wrap gap-3">
            <label
              v-for="m in modelOptions"
              :key="m.id"
              class="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white cursor-pointer hover:border-primary/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <input
                v-model="selectedModelIds"
                type="checkbox"
                :value="m.id"
                class="rounded border-gray-300 text-primary focus:ring-primary"
              >
              <span class="text-sm text-gray-800">{{ m.label }}</span>
            </label>
          </div>
        </fieldset>

        <button
          type="button"
          class="px-4 py-2.5 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="!canGenerate"
          @click="generateConcepts"
        >
          {{ generating ? 'Generating concepts...' : 'Generate Concepts' }}
        </button>

        <p v-if="generating" class="mt-4 text-sm text-gray-600 animate-pulse">
          Generating concepts...
        </p>

        <div v-if="conceptResults != null && conceptResults.length" class="mt-8 space-y-4">
          <h3 class="text-sm font-semibold text-gray-800 uppercase tracking-wide">Results</h3>
          <div class="grid gap-4 sm:grid-cols-1">
            <article
              v-for="(r, idx) in conceptResults"
              :key="`${r.model}-${idx}`"
              class="rounded-xl border p-4 sm:p-5 bg-white shadow-sm"
              :class="r.error ? 'border-red-200 bg-red-50/50' : 'border-gray-200'"
            >
              <div class="flex flex-wrap items-start justify-between gap-2 mb-3">
                <span class="text-xs font-semibold uppercase tracking-wide text-primary">
                  {{ modelLabel(r.model) }}
                </span>
              </div>
              <template v-if="!r.error">
                <h4 class="text-base font-bold text-gray-900 mb-2">{{ r.title }}</h4>
                <p class="text-sm text-gray-700 italic mb-3">{{ r.logline }}</p>
                <p class="text-sm text-gray-600 whitespace-pre-wrap mb-4">{{ r.summary }}</p>
                <div class="flex flex-wrap gap-2 mb-4">
                  <span v-if="r.tone" class="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-800">{{ r.tone }}</span>
                  <span v-if="r.genre" class="text-xs px-2 py-1 rounded-md bg-gray-200 text-gray-800 capitalize">{{ r.genre }}</span>
                </div>
                <button
                  type="button"
                  class="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-colors"
                  :disabled="applyingModel === r.model"
                  @click="useThisConcept(r)"
                >
                  {{ applyingModel === r.model ? 'Saving…' : 'Use this concept' }}
                </button>
              </template>
              <template v-else>
                <p class="text-sm text-red-800">{{ r.error }}</p>
              </template>
            </article>
          </div>
        </div>
      </template>
    </section>

    <div
      v-if="!scriptUploadedAwaitingAnalyze"
      class="rounded-xl border border-gray-200 bg-white p-4 mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
    >
      <div>
        <h2 class="text-sm font-semibold text-gray-900">Director & continuity</h2>
        <p class="text-sm text-gray-500 mt-0.5">
          Presets, camera bible, and continuity memory are on their own tab.
        </p>
      </div>
      <NuxtLink
        :to="`/projects/${projectId}/director`"
        class="shrink-0 px-4 py-2 border border-primary/40 text-primary hover:bg-primary/10 rounded-lg text-sm font-medium transition-colors inline-flex items-center justify-center"
      >
        Open Director →
      </NuxtLink>
    </div>

    <h2 v-if="!scriptUploadedAwaitingAnalyze" class="text-lg font-semibold text-gray-900 mb-3">Quick actions</h2>
    <div v-if="!scriptUploadedAwaitingAnalyze" class="flex flex-wrap gap-3">
      <NuxtLink
        :to="`/projects/${projectId}/scenes`"
        class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg text-sm font-medium transition-colors inline-flex items-center"
      >
        Add Scene
      </NuxtLink>
      <NuxtLink
        :to="`/projects/${projectId}/director`"
        class="px-4 py-2 border border-gray-200 text-gray-800 hover:border-primary/50 rounded-lg text-sm font-medium transition-colors inline-flex items-center"
      >
        Director →
      </NuxtLink>
      <NuxtLink
        v-if="!showImportedScriptOverview && !scratchWorkflow"
        :to="`/projects/${projectId}/story`"
        class="px-4 py-2 border border-primary/40 text-primary hover:bg-primary/10 rounded-lg text-sm font-medium transition-colors inline-flex items-center"
      >
        Script →
      </NuxtLink>
      <template v-else>
        <NuxtLink
          :to="`/projects/${projectId}/storyboard`"
          class="px-4 py-2 bg-primary hover:bg-primary/90 text-gray-950 rounded-lg text-sm font-semibold transition-colors inline-flex items-center"
        >
          Storyboard →
        </NuxtLink>
        <NuxtLink
          :to="`/projects/${projectId}/characters`"
          class="px-4 py-2 border border-primary/40 text-primary hover:bg-primary/10 rounded-lg text-sm font-medium transition-colors inline-flex items-center"
        >
          Characters →
        </NuxtLink>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { projectStorySatisfiedByScriptImport } from '~/lib/project-workflow'
import { extractThreeActBreakdownFromTreatment } from '~/lib/extract-three-act-from-treatment'
import { formatApiFetchError } from '~/lib/format-api-fetch-error'
import {
  conceptNotesHaveUserContent,
  formatStoredConceptNotes,
  parseCharactersFromConceptNotes,
  parseLoglineFromConceptNotes,
  stripConceptMetadataMarkers
} from '~/lib/format-stored-concept'
import { defaultDurationSecondsForProject } from '~/lib/project-duration-budget'
import { pollScriptImportJob } from '~/lib/poll-script-import-job'
import { SCRIPT_WIZARD_UPLOAD_CLIENT_MS } from '~/lib/script-wizard-timeouts'
import type { StoryIdeaApplyPayload } from '~/components/story/StoryIdeaGeneratorPanel.vue'
import type { ConceptGeneratorResultItem, GeneratedConceptItem } from '~/types/concept-generator'
import type { CreativeCharacter, CreativeProject } from '~/types/creative-project'
import type { ProjectAsset } from '~/types/project-asset'

type OverviewComparableCandidate = { title: string; year?: string }
type OverviewOmdbMovie = {
  title: string
  year?: string
  imdbId?: string
  genre?: string
  plot?: string
  poster?: string
  imdbRating?: string
  rottenTomatoes?: string
}

const { activeProject, activeProjectId, updateProject, registerImportedProject, withProjectQuery } =
  useCreativeProject()
const { isAuthenticated, getAuthToken } = useAuth()
const { stepBadge } = useProjectWorkflowStep()
const toast = useToast()
const route = useRoute()

const PB_ID = /^[a-z0-9]{15}$/

const projectId = activeProjectId
const project = activeProject

const overviewCandidates = ref<OverviewComparableCandidate[]>([])
const overviewMovies = ref<OverviewOmdbMovie[]>([])
const loadingOverviewMovies = ref(false)
const overviewMoviesError = ref('')
/** false = server has no OMDB_API_KEY; true = key present; null = not loaded yet */
const overviewOmdbConfigured = ref<boolean | null>(null)
const overviewMoviesWarning = ref('')

const overviewCharacters = ref<CreativeCharacter[]>([])
const loadingOverviewCharacters = ref(false)
const overviewCharactersError = ref('')

const showImportedScriptOverview = computed(() => projectStorySatisfiedByScriptImport(project.value))

const threeActBreakdown = computed(() =>
  extractThreeActBreakdownFromTreatment(project.value?.treatment || '')
)

const canLoadImportedMovies = computed(
  () =>
    isAuthenticated.value &&
    PB_ID.test(projectId.value) &&
    showImportedScriptOverview.value
)

const isLocalProject = computed(() => !PB_ID.test(projectId.value))

const canCloudImport = computed(() => isAuthenticated.value && PB_ID.test(projectId.value))

const overviewImportFile = ref<File | null>(null)
const overviewImporting = ref(false)
const overviewAnalyzing = ref(false)
const overviewFullImporting = ref(false)
const overviewPreviewing = ref(false)
const overviewImportError = ref('')
const fullImportAttempted = ref(false)
const scriptWorkflowAssetId = ref('')
const overviewAspect = ref<'16:9' | '9:16' | '1:1'>('16:9')
const overviewGoal = ref<'film' | 'social' | 'commercial' | 'other'>('film')
const selectedAnalysisModelIds = ref<string[]>(['claude'])
const analysisCandidates = ref<Array<{
  modelId: string
  label: string
  synopsis?: string
  treatment?: string
  genre?: string
  tone?: string
  error?: string
}>>([])

async function syncScriptWorkflowAssetFromServer () {
  const id = projectId.value
  const token = getAuthToken()
  if (!id || !token || !PB_ID.test(id)) {
    scriptWorkflowAssetId.value = ''
    return
  }
  try {
    const res = await $fetch<{ items: ProjectAsset[]; warning?: string }>(`/api/projects/${id}/assets`, {
      params: { kind: 'script' },
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.warning) {
      toast.showToast(res.warning, 'warning')
    }
    let best = ''
    let bestCreated = ''
    for (const a of res.items || []) {
      const src =
        a.metadata && typeof a.metadata === 'object' && a.metadata !== null && 'source' in a.metadata
          ? String((a.metadata as { source?: string }).source)
          : ''
      if (src !== 'script_import') continue
      const c = a.created || ''
      if (!bestCreated || c >= bestCreated) {
        bestCreated = c
        best = a.id
      }
    }
    scriptWorkflowAssetId.value = best
  } catch {
    /* ignore */
  }
}

watch(
  () => projectId.value,
  () => {
    fullImportAttempted.value = false
    void syncScriptWorkflowAssetFromServer()
  },
  { immediate: true }
)

watch(
  [() => route.query.bootstrap, scriptWorkflowAssetId, showImportedScriptOverview, canCloudImport],
  ([bootstrap]) => {
    if (fullImportAttempted.value) return
    if (bootstrap !== '1') return
    if (!canCloudImport.value) return
    if (!scriptWorkflowAssetId.value) return
    if (showImportedScriptOverview.value) return
    fullImportAttempted.value = true
    void runProjectFullImport()
  },
  { immediate: true }
)

function onOverviewImportFile (e: Event) {
  const input = e.target as HTMLInputElement
  overviewImportFile.value = input.files?.[0] || null
}

async function importScriptFromOverview () {
  const id = projectId.value
  const token = getAuthToken()
  const file = overviewImportFile.value
  if (!id || !token || !file) return
  overviewImporting.value = true
  overviewImportError.value = ''
  try {
    const form = new FormData()
    form.append('file', file)
    const res = await $fetch<{
      project: CreativeProject
      scriptAsset: { ok: boolean; message?: string; id?: string }
      upload?: { previewSceneCount: number; parseWarning?: string }
    }>(`/api/projects/${id}/import-script`, {
      method: 'POST',
      body: form,
      headers: { Authorization: `Bearer ${token}` },
      timeout: SCRIPT_WIZARD_UPLOAD_CLIENT_MS
    })
    registerImportedProject(res.project)
    overviewImportFile.value = null
    if (res.scriptAsset?.ok && res.scriptAsset.id) {
      scriptWorkflowAssetId.value = res.scriptAsset.id
    } else {
      await syncScriptWorkflowAssetFromServer()
    }
    toast.showToast(
      'Screenplay saved. It appears under Assets → Scripts (sidebar). Run director analysis on Overview when you want synopsis, treatment, and director bible — then generate cast, scenes, and storyboard from their tabs.',
      'success'
    )
    if (res.upload?.parseWarning) {
      toast.showToast(`Parse preview: ${res.upload.parseWarning}`, 'info')
    }
    if (res.scriptAsset && !res.scriptAsset.ok) {
      toast.showToast(
        `Project updated, but the screenplay file was not saved to Assets: ${res.scriptAsset.message || 'unknown error'}`,
        'warning'
      )
    }
  } catch (e: unknown) {
    overviewImportError.value = formatApiFetchError(e, 'Save failed')
    toast.showToast(overviewImportError.value, 'error')
  } finally {
    overviewImporting.value = false
  }
}

async function runProjectFullImport () {
  const id = projectId.value
  const token = getAuthToken()
  if (!id || !token || !scriptWorkflowAssetId.value) return
  overviewFullImporting.value = true
  overviewImportError.value = ''
  try {
    const res = await $fetch<{
      project: CreativeProject
      scriptAsset: { ok: boolean; message?: string; id?: string }
    }>(`/api/projects/${id}/script/full-import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { assetId: scriptWorkflowAssetId.value },
      timeout: SCRIPT_WIZARD_UPLOAD_CLIENT_MS
    })
    registerImportedProject(res.project)
    if (res.scriptAsset?.ok && res.scriptAsset.id) {
      scriptWorkflowAssetId.value = res.scriptAsset.id
    }
    toast.showToast('Script imported — open Storyboard to generate video clips.', 'success')
    await navigateTo(`/projects/${id}/storyboard`)
  } catch (e: unknown) {
    overviewImportError.value = formatApiFetchError(e, 'Full script import failed')
    toast.showToast(overviewImportError.value, 'error')
  } finally {
    overviewFullImporting.value = false
  }
}

async function runScriptAnalyzeFromOverview (chosenModelId?: string) {
  const id = projectId.value
  const token = getAuthToken()
  if (!id || !token) return
  overviewAnalyzing.value = true
  overviewImportError.value = ''
  try {
    const body = scriptWorkflowAssetId.value ? { assetId: scriptWorkflowAssetId.value } : {}
    const finalBody = chosenModelId ? { ...body, chosenModelId } : body
    const res = await $fetch<{
      project: CreativeProject
      scriptAsset: { ok: boolean; message?: string; id?: string }
    }>(`/api/projects/${id}/script/analyze`, {
      method: 'POST',
      body: finalBody,
      headers: { Authorization: `Bearer ${token}` },
      timeout: SCRIPT_WIZARD_UPLOAD_CLIENT_MS
    })
    registerImportedProject(res.project)
    if (res.scriptAsset?.ok && res.scriptAsset.id) {
      scriptWorkflowAssetId.value = res.scriptAsset.id
    }
    analysisCandidates.value = []
    toast.showToast('Director analysis finished — review Overview and Director, then generate cast and scenes when ready.', 'success')
    if (res.scriptAsset && !res.scriptAsset.ok) {
      toast.showToast(res.scriptAsset.message || 'Project updated; asset notes may be incomplete.', 'info')
    }
    void loadOverviewCharacters()
  } catch (e: unknown) {
    overviewImportError.value = formatApiFetchError(e, 'AI import failed')
    toast.showToast(overviewImportError.value, 'error')
  } finally {
    overviewAnalyzing.value = false
  }
}

function runDefaultScriptAnalyze () {
  return runScriptAnalyzeFromOverview()
}

function applyCandidateModel (modelId: string) {
  return runScriptAnalyzeFromOverview(modelId)
}

async function previewScriptAnalyses () {
  const id = projectId.value
  const token = getAuthToken()
  if (!id || !token || !selectedAnalysisModelIds.value.length) return
  overviewPreviewing.value = true
  overviewImportError.value = ''
  try {
    const body = {
      mode: 'preview' as const,
      selectedModels: [...selectedAnalysisModelIds.value],
      ...(scriptWorkflowAssetId.value ? { assetId: scriptWorkflowAssetId.value } : {})
    }
    const res = await $fetch<{ candidates: Array<{
      modelId: string
      label: string
      synopsis?: string
      treatment?: string
      genre?: string
      tone?: string
      error?: string
    }> }>(`/api/projects/${id}/script/analyze`, {
      method: 'POST',
      body,
      headers: { Authorization: `Bearer ${token}` },
      timeout: SCRIPT_WIZARD_UPLOAD_CLIENT_MS
    })
    analysisCandidates.value = res.candidates || []
  } catch (e: unknown) {
    overviewImportError.value = formatApiFetchError(e, 'Analysis preview failed')
    toast.showToast(overviewImportError.value, 'error')
  } finally {
    overviewPreviewing.value = false
  }
}

const modelOptions = ref<Array<{ id: string; label: string }>>([])
const modelsLoadError = ref('')
const conceptPrompt = ref('')
const conceptReferenceImage = ref<string | null>(null)
const selectedModelIds = ref<string[]>([])
const generating = ref(false)
const conceptResults = ref<ConceptGeneratorResultItem[] | null>(null)
const applyingModel = ref<string | null>(null)
const showGeneratorForm = ref(true)
const deletingConcept = ref(false)
const conceptBootstrapRunning = ref(false)
const conceptBootstrapError = ref('')
const pipelineBuilt = ref<boolean | null>(null)
const targetDurationSeconds = ref<string>('')
const targetDurationTouched = ref(false)
const scratchIdeaPanelRef = ref<{ clearApplying: () => void; clearResults: () => void } | null>(null)

const conceptSynopsisDisplay = computed(() => {
  const p = project.value
  if (!p) return ''
  const syn = (p.synopsis || '').trim()
  if (syn) return syn
  const logline = parseLoglineFromConceptNotes(p.conceptNotes || '')
  if (logline) return logline
  return stripConceptMetadataMarkers(p.conceptNotes || '')
})

const hasConcept = computed(() => {
  const p = project.value
  if (!p) return false
  return Boolean((p.synopsis || '').trim() || conceptNotesHaveUserContent(p.conceptNotes || ''))
})

const screenplayWorkflowEnabled = computed(
  () => project.value?.workflowMode !== 'scratch'
)

/** Prompt-based concept generator — only for “start from scratch” projects, not script-import workflow. */
const scratchWorkflow = computed(() => project.value?.workflowMode === 'scratch')

const showScratchIdeaGenerator = computed(
  () =>
    scratchWorkflow.value &&
    (showGeneratorForm.value || !hasConcept.value) &&
    !scriptUploadedAwaitingAnalyze.value
)

const showImportWorkflowOverview = computed(
  () =>
    screenplayWorkflowEnabled.value &&
    (showGeneratorForm.value || !hasConcept.value) &&
    !scriptUploadedAwaitingAnalyze.value
)

const scratchGeneratorHeading = computed(() => {
  if (project.value?.goal === 'social') return 'Generate story ideas'
  if (project.value?.goal === 'commercial') return 'Generate your concept'
  return 'Start with your idea'
})

const scratchGeneratorBlurb = computed(() => {
  if (project.value?.goal === 'social') {
    return 'Describe a hook, mood, or topic. Pick one or more AI models, compare ideas, then choose the story you want to turn into shots and video.'
  }
  return 'Describe your idea (and optionally upload a reference image). Pick models to compare — they use both to draft story, director bible, and prompts.'
})

const scratchPromptPlaceholder = computed(() => {
  if (project.value?.goal === 'social') {
    return 'e.g. Anthropomorphic egg sandwich wakes up in a diner, realizes it is today’s special — 30s vertical comedy, snappy pacing…'
  }
  if (project.value?.goal === 'commercial') {
    return 'e.g. Launch spot for a cold-brew brand — morning ritual, product hero shot, upbeat tone, 15s vertical…'
  }
  return 'Describe your film or video idea — genre, mood, characters, and what happens…'
})

const generateIdeasButtonLabel = computed(() => {
  if (generating.value) return 'Generating ideas…'
  if (project.value?.goal === 'social') return 'Generate story ideas'
  return 'Generate concepts'
})

/** After screenplay save, before AI import: single-focus screen with only the run-import CTA. */
const scriptUploadedAwaitingAnalyze = computed(
  () =>
    screenplayWorkflowEnabled.value &&
    canCloudImport.value &&
    hasConcept.value &&
    Boolean(scriptWorkflowAssetId.value) &&
    !showImportedScriptOverview.value
)

/** Workflow screenplay file saved to project assets (Overview import). */
const hasWorkflowScreenplaySaved = computed(
  () => screenplayWorkflowEnabled.value && canCloudImport.value && Boolean(scriptWorkflowAssetId.value)
)

/** Emphasize Run director analysis until treatment marker appears (script import path). */
const highlightRunTreatmentImport = computed(
  () => screenplayWorkflowEnabled.value && Boolean(scriptWorkflowAssetId.value) && !showImportedScriptOverview.value
)

watch(hasConcept, (has) => {
  showGeneratorForm.value = !has
}, { immediate: true })

function syncTargetDurationFromProject (forceDefault = false) {
  const p = project.value
  if (!p) {
    targetDurationSeconds.value = ''
    return
  }
  if (typeof p.targetDurationSeconds === 'number' && p.targetDurationSeconds > 0) {
    targetDurationSeconds.value = String(p.targetDurationSeconds)
    return
  }
  if (!targetDurationTouched.value || forceDefault) {
    const def = defaultDurationSecondsForProject({
      goal: p.goal,
      targetLength: p.targetLength
    })
    targetDurationSeconds.value = def != null ? String(def) : ''
  }
}

watch(projectId, () => {
  targetDurationTouched.value = false
  syncTargetDurationFromProject(true)
}, { immediate: true })

watch(
  () => project.value?.targetDurationSeconds,
  (v) => {
    if (targetDurationTouched.value) return
    if (typeof v === 'number' && v > 0) {
      targetDurationSeconds.value = String(v)
    }
  }
)

function parsedTargetDurationSeconds (): number | null {
  const raw = String(targetDurationSeconds.value || '').trim()
  if (!raw) return null
  const n = Math.floor(Number(raw))
  if (!Number.isFinite(n) || n < 15 || n > 3600) return null
  return n
}

function onTargetDurationInput () {
  targetDurationTouched.value = true
}

async function persistTargetDuration () {
  const id = projectId.value
  if (!id || !canCloudImport.value) return
  const n = parsedTargetDurationSeconds()
  try {
    await updateProject(id, {
      targetDurationSeconds: n
    })
    targetDurationTouched.value = true
  } catch {
    toast.showToast('Could not save target runtime.', 'error')
  }
}

const showConceptBootstrapCta = computed(
  () =>
    scratchWorkflow.value &&
    canCloudImport.value &&
    hasConcept.value &&
    !showImportedScriptOverview.value &&
    !conceptBootstrapRunning.value &&
    pipelineBuilt.value === false
)

async function loadPipelineBuilt () {
  const id = projectId.value
  const token = getAuthToken()
  if (!scratchWorkflow.value || !id || !token || !PB_ID.test(id)) {
    pipelineBuilt.value = null
    return
  }
  if (showImportedScriptOverview.value) {
    pipelineBuilt.value = true
    return
  }
  try {
    const res = await $fetch<{ scenes: unknown[] }>(`/api/projects/${id}/scenes`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    pipelineBuilt.value = (res.scenes?.length ?? 0) > 0
  } catch {
    pipelineBuilt.value = false
  }
}

watch(
  () =>
    [
      projectId.value,
      scratchWorkflow.value,
      hasConcept.value,
      showImportedScriptOverview.value,
      canCloudImport.value
    ] as const,
  () => {
    void loadPipelineBuilt()
  },
  { immediate: true }
)

function resolveBootstrapSummary (p: CreativeProject | null | undefined, override?: string): string {
  const fromOverride = (override || '').trim()
  if (fromOverride) return fromOverride
  const syn = (p?.synopsis || '').trim()
  if (syn) return syn
  const logline = parseLoglineFromConceptNotes(p?.conceptNotes || '')
  if (logline) return logline
  return stripConceptMetadataMarkers(p?.conceptNotes || '')
}

async function runConceptBootstrap (opts?: {
  title?: string
  logline?: string
  summary?: string
  genre?: string
  tone?: string
  characters?: string[]
  director?: import('~/types/creative-project').ProjectDirector
  visualReference?: string
}) {
  const id = projectId.value
  const token = getAuthToken()
  if (!id || !token) return
  const p = project.value
  const title = (opts?.title || p?.name || '').trim()
  const summary = resolveBootstrapSummary(p, opts?.summary)
  if (!title || !summary) {
    conceptBootstrapError.value =
      'Add a story synopsis first (generate ideas and pick one, or paste your idea), then build again.'
    toast.showToast(conceptBootstrapError.value, 'error')
    return
  }
  await persistTargetDuration()
  conceptBootstrapRunning.value = true
  conceptBootstrapError.value = ''
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  try {
    const body = {
      title,
      logline: opts?.logline || parseLoglineFromConceptNotes(p?.conceptNotes || '') || summary.split('\n')[0],
      summary,
      genre: opts?.genre || p?.genre,
      tone: opts?.tone || p?.tone,
      characters: opts?.characters?.length
        ? opts.characters
        : parseCharactersFromConceptNotes(p?.conceptNotes || ''),
      ...(opts?.director ? { director: opts.director } : {}),
      ...(opts?.visualReference ? { visual_reference: opts.visualReference } : {})
    }
    const started = await $fetch<{ async: boolean; jobId: string }>(
      `/api/projects/${id}/bootstrap-from-concept`,
      { method: 'POST', headers, body }
    )
    if (!started.jobId) {
      throw new Error('Server did not start build job')
    }
    const polled = await pollScriptImportJob(started.jobId, headers, {
      maxMs: SCRIPT_WIZARD_UPLOAD_CLIENT_MS
    })
    registerImportedProject(polled.project)
    pipelineBuilt.value = true
    toast.showToast('Project built — opening Storyboard.', 'success')
    await navigateTo(withProjectQuery(`/projects/${id}/storyboard`))
  } catch (e: unknown) {
    conceptBootstrapError.value = formatApiFetchError(
      e,
      'Could not build project from this story. Try again or use Claude instead of Llama for faster results.'
    )
    toast.showToast(conceptBootstrapError.value, 'error')
  } finally {
    conceptBootstrapRunning.value = false
  }
}

async function loadOverviewMovies () {
  const id = projectId.value
  const token = getAuthToken()
  overviewMoviesError.value = ''
  overviewMoviesWarning.value = ''
  if (!id || !token || !PB_ID.test(id) || !showImportedScriptOverview.value) {
    overviewCandidates.value = []
    overviewMovies.value = []
    overviewOmdbConfigured.value = null
    return
  }
  loadingOverviewMovies.value = true
  try {
    const res = await $fetch<{
      candidates: OverviewComparableCandidate[]
      movies: OverviewOmdbMovie[]
      omdbConfigured?: boolean
      warning?: string
    }>(
      `/api/projects/${id}/script-wizard/movies`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    overviewCandidates.value = res.candidates || []
    overviewMovies.value = res.movies || []
    overviewOmdbConfigured.value =
      typeof res.omdbConfigured === 'boolean' ? res.omdbConfigured : null
    if (res.warning) {
      overviewMoviesWarning.value = res.warning
    }
  } catch (e: unknown) {
    overviewMoviesError.value = formatApiFetchError(e, 'Could not load comparable films')
    overviewOmdbConfigured.value = null
  } finally {
    loadingOverviewMovies.value = false
  }
}

async function loadOverviewCharacters () {
  const id = projectId.value
  const token = getAuthToken()
  overviewCharactersError.value = ''
  if (!id || !token || !PB_ID.test(id) || !showImportedScriptOverview.value) {
    overviewCharacters.value = []
    return
  }
  loadingOverviewCharacters.value = true
  try {
    const res = await $fetch<{ characters: CreativeCharacter[] }>(
      `/api/projects/${id}/characters`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    overviewCharacters.value = res.characters || []
  } catch (e: unknown) {
    overviewCharactersError.value = formatApiFetchError(e, 'Could not load characters')
    overviewCharacters.value = []
  } finally {
    loadingOverviewCharacters.value = false
  }
}

watch(
  () => [projectId.value, project.value?.treatment, canLoadImportedMovies.value] as const,
  () => {
    if (canLoadImportedMovies.value) {
      void loadOverviewMovies()
      void loadOverviewCharacters()
    } else {
      overviewCandidates.value = []
      overviewMovies.value = []
      overviewMoviesError.value = ''
      overviewOmdbConfigured.value = null
      overviewMoviesWarning.value = ''
      overviewCharacters.value = []
      overviewCharactersError.value = ''
    }
  },
  { immediate: true }
)

const canGenerate = computed(() => {
  if (generating.value) return false
  if (!isAuthenticated.value) return false
  if (!conceptPrompt.value.trim() && !conceptReferenceImage.value) return false
  if (!selectedModelIds.value.length) return false
  return true
})

function modelLabel (modelId: string) {
  return modelOptions.value.find(m => m.id === modelId)?.label ?? modelId
}

function openGeneratorAgain () {
  showGeneratorForm.value = true
  nextTick(() => promptTextareaRef.value?.focus())
}

function cancelGeneratorPanel () {
  showGeneratorForm.value = false
}

async function deleteConcept () {
  if (!confirm('Remove this concept? Synopsis and concept notes will be cleared.')) return
  const id = projectId.value
  if (!id) return
  deletingConcept.value = true
  try {
    await updateProject(id, { synopsis: '', conceptNotes: '', genre: '', tone: '' })
    conceptResults.value = null
    showGeneratorForm.value = true
    toast.showToast('Concept removed.', 'success')
  } catch {
    toast.showToast('Could not remove concept.', 'error')
  } finally {
    deletingConcept.value = false
  }
}

async function loadModelOptions () {
  modelsLoadError.value = ''
  try {
    const res = await $fetch<{ models: Array<{ id: string; label: string }> }>('/api/concept-generator-models')
    modelOptions.value = res.models ?? []
    if (!selectedModelIds.value.length && modelOptions.value.length) {
      selectedModelIds.value = [modelOptions.value[0]!.id]
    }
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'data' in e
      ? String((e as { data?: { message?: string } }).data?.message)
      : 'Could not load models.'
    modelsLoadError.value = msg || 'Could not load models.'
  }
}

onMounted(() => {
  void loadModelOptions()
})

async function generateConcepts () {
  const id = projectId.value
  if (!id || !canGenerate.value) return
  const token = getAuthToken()
  if (!token) {
    toast.showToast('Log in to generate concepts.', 'error')
    return
  }
  generating.value = true
  conceptResults.value = null
  try {
    await persistTargetDuration()
    const runtimeSec = parsedTargetDurationSeconds()
    const res = await $fetch<ConceptGeneratorResultItem[]>('/api/generate-concepts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        project_id: id,
        user_prompt: conceptPrompt.value.trim(),
        selected_models: [...selectedModelIds.value],
        goal: project.value?.goal,
        aspect_ratio: project.value?.aspectRatio,
        ...(runtimeSec != null ? { target_duration_seconds: runtimeSec } : {}),
        ...(conceptReferenceImage.value ? { reference_image: conceptReferenceImage.value } : {})
      }
    })
    conceptResults.value = Array.isArray(res) ? res : []
    const ok = conceptResults.value.filter(r => !('error' in r && r.error)).length
    const fail = conceptResults.value.length - ok
    if (ok && !fail) {
      toast.showToast(`Received ${ok} concept(s).`, 'success')
    } else if (ok && fail) {
      toast.showToast(`${ok} succeeded, ${fail} failed — see cards.`, 'info')
    } else {
      toast.showToast('All model requests failed — see cards.', 'error')
    }
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'data' in e
        ? (e as { data?: { message?: string; statusMessage?: string } }).data?.message ||
          (e as { data?: { statusMessage?: string } }).data?.statusMessage
        : e instanceof Error
          ? e.message
          : 'Generation failed.'
    toast.showToast(msg || 'Generation failed.', 'error')
  } finally {
    generating.value = false
  }
}

function isSuccessResult (r: ConceptGeneratorResultItem): r is GeneratedConceptItem {
  if ('error' in r && typeof (r as { error?: unknown }).error === 'string') {
    return false
  }
  return typeof (r as GeneratedConceptItem).title === 'string'
}

async function onScratchIdeaApply (payload: StoryIdeaApplyPayload) {
  await useThisConcept(payload.item, payload)
  scratchIdeaPanelRef.value?.clearResults()
}

async function useThisConcept (
  item: ConceptGeneratorResultItem,
  format?: StoryIdeaApplyPayload
) {
  if (!isSuccessResult(item)) return
  const id = projectId.value
  if (!id) return
  applyingModel.value = item.model
  try {
    const label = modelLabel(item.model)
    const conceptNotes = formatStoredConceptNotes({
      title: item.title,
      logline: item.logline,
      modelId: item.model,
      modelLabel: label,
      characters: item.characters
    })
    const synopsis = (item.summary || item.logline || '').trim()
    await updateProject(id, {
      name: item.title.slice(0, 500),
      synopsis,
      genre: item.genre || undefined,
      tone: item.tone || undefined,
      conceptNotes,
      ...(format ? { goal: format.goal, aspectRatio: format.aspectRatio } : {}),
      ...(item.director ? { director: item.director } : {})
    })
    conceptResults.value = null
    showGeneratorForm.value = false
    if (scratchWorkflow.value && canCloudImport.value) {
      toast.showToast('Story saved — open Director to refine your bible.', 'success')
      await navigateTo(`/projects/${id}/director`)
      return
    }
    toast.showToast('Concept applied to project.', 'success')
  } catch {
    toast.showToast('Could not save concept.', 'error')
  } finally {
    applyingModel.value = null
    scratchIdeaPanelRef.value?.clearApplying()
  }
}

</script>

<style scoped>
:deep(button.w-full.sm\:w-auto.px-6.py-3\.5.bg-primary.hover\:bg-primary\/90.text-gray-950.rounded-xl.text-base.font-bold.transition-colors.disabled\:opacity-50.shadow-md) {
  display: none;
}
</style>
