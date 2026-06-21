<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
    <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 sm:mb-10">
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Projects</h1>
        <p class="text-gray-600 text-sm sm:text-base max-w-xl">
          Create a project in one step — start with your own idea, generate one with AI, or import a screenplay — then work through story, director, characters, scenes, storyboard, and video.
        </p>
      </div>
      <button
        type="button"
        class="shrink-0 px-5 py-2.5 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg transition-colors"
        @click="openCreateModal"
      >
        New project
      </button>
    </div>

    <div v-if="!clientReady" class="text-gray-600 py-12">Loading projects…</div>

    <div v-else-if="projects.length === 0" class="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
      <p class="text-gray-700 mb-2 font-medium">No projects yet</p>
      <p class="text-sm text-gray-500 mb-6">
        Start with a single click — you can tune aspect ratio and goal under “More options” if you want.
      </p>
      <button
        type="button"
        class="px-5 py-2.5 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg transition-colors"
        @click="openCreateModal"
      >
        Create your first project
      </button>
    </div>

    <ul v-else class="grid gap-4 sm:grid-cols-2">
      <li v-for="p in projects" :key="p.id">
        <NuxtLink
          :to="`/projects/${p.id}/home`"
          class="block rounded-xl border border-gray-200 bg-white shadow-sm hover:border-primary/50 hover:bg-gray-50 transition-all p-5 h-full"
        >
          <div class="flex items-start justify-between gap-3 mb-3">
            <h2 class="text-lg font-semibold text-gray-900">{{ p.name }}</h2>
            <span class="shrink-0 text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-700">{{ p.aspectRatio }}</span>
          </div>
          <p class="text-sm text-gray-500 line-clamp-2 mb-3">
            {{ p.synopsis || 'No synopsis yet — open to get started.' }}
          </p>
          <span class="text-sm text-primary font-medium">Open workspace →</span>
        </NuxtLink>
      </li>
    </ul>

    <Teleport to="body">
      <div
        v-if="openCreate"
        class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-project-title"
        @click.self="closeModal"
      >
        <div
          class="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl p-6 max-h-[90vh] overflow-y-auto"
          @click.stop
        >
          <h2 id="create-project-title" class="text-lg font-semibold text-gray-900 mb-1">New project</h2>
          <p class="text-sm text-gray-500 mb-5">
            Name it (optional). We’ll use “New project” if you leave it blank.
          </p>

          <form class="space-y-4" @submit.prevent="submitCreate">
            <div>
              <p class="block text-sm font-medium text-gray-700 mb-2">How do you want to start?</p>
              <label class="flex items-start gap-2 rounded-lg border border-gray-200 px-3 py-2 mb-2">
                <input
                  v-model="form.workflowMode"
                  type="radio"
                  value="idea"
                  class="mt-0.5"
                >
                <span class="text-sm text-gray-700">
                  <span class="font-medium text-gray-900">I have an idea</span><br>
                  Paste your story on Overview and continue — no AI generation step.
                </span>
              </label>
              <label class="flex items-start gap-2 rounded-lg border border-gray-200 px-3 py-2 mb-2">
                <input
                  v-model="form.workflowMode"
                  type="radio"
                  value="generate"
                  class="mt-0.5"
                >
                <span class="text-sm text-gray-700">
                  <span class="font-medium text-gray-900">Generate idea</span><br>
                  Compare AI story ideas from a short prompt — great for social and short-form.
                </span>
              </label>
              <label class="flex items-start gap-2 rounded-lg border border-gray-200 px-3 py-2">
                <input
                  v-model="form.workflowMode"
                  type="radio"
                  value="import"
                  class="mt-0.5"
                >
                <span class="text-sm text-gray-700">
                  <span class="font-medium text-gray-900">Import script</span><br>
                  Upload a screenplay on Overview and run director analysis.
                </span>
              </label>
            </div>

            <div>
              <label for="proj-name" class="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                id="proj-name"
                v-model="form.name"
                type="text"
                class="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 focus:outline-none focus:border-primary"
                placeholder="New project"
                autocomplete="off"
              >
            </div>

            <button
              type="button"
              class="text-sm font-medium text-primary hover:underline"
              @click="showOptions = !showOptions"
            >
              {{ showOptions ? 'Hide options' : 'More options (aspect ratio & goal)' }}
            </button>

            <div v-show="showOptions" class="space-y-4 pt-1 border-t border-gray-100">
              <div>
                <label for="proj-aspect" class="block text-sm font-medium text-gray-700 mb-1">Aspect ratio</label>
                <select
                  id="proj-aspect"
                  v-model="form.aspectRatio"
                  class="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 focus:outline-none focus:border-primary"
                >
                  <option value="16:9">16:9 (landscape)</option>
                  <option value="9:16">9:16 (vertical)</option>
                  <option value="1:1">1:1 (square)</option>
                </select>
              </div>
              <div>
                <label for="proj-goal" class="block text-sm font-medium text-gray-700 mb-1">Goal</label>
                <select
                  id="proj-goal"
                  v-model="form.goal"
                  class="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 focus:outline-none focus:border-primary"
                >
                  <option value="film">Film</option>
                  <option value="social">Social (short-form)</option>
                  <option value="commercial">Commercial</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <p v-if="createError" class="text-sm text-red-600">{{ createError }}</p>
            <p v-if="!isAuthenticated" class="text-xs text-gray-500">
              You’re not signed in — this project will be saved on this device only. Sign in later to sync to your account.
            </p>

            <div class="flex gap-2 justify-end pt-2">
              <button
                type="button"
                class="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                :disabled="creating"
                @click="closeModal"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="creating"
                class="px-4 py-2 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[8rem]"
              >
                {{ creating ? 'Creating…' : 'Create & open' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { writeSessionWorkflow } from '~/lib/project-workflow-mode'
import type { ProjectAspectRatio, ProjectGoal, ProjectWorkflowMode } from '~/types/creative-project'

const { projects, createProject, clientReady, registerImportedProject } = useCreativeProject()
const { isAuthenticated, getAuthToken } = useAuth()
const toast = useToast()

const openCreate = ref(false)
const showOptions = ref(false)
const creating = ref(false)
const createError = ref('')

const form = reactive({
  name: '',
  aspectRatio: '16:9' as ProjectAspectRatio,
  goal: 'film' as ProjectGoal,
  workflowMode: 'idea' as ProjectWorkflowMode
})

function openCreateModal () {
  openCreate.value = true
}

function closeModal () {
  if (creating.value) return
  openCreate.value = false
}

watch(openCreate, (v) => {
  if (!v) return
  form.name = ''
  form.aspectRatio = '16:9'
  form.goal = 'film'
  form.workflowMode = 'idea'
  showOptions.value = false
  createError.value = ''
})

watch(
  () => form.goal,
  (goal) => {
    if (goal === 'social') form.aspectRatio = '9:16'
  }
)

async function submitCreate () {
  createError.value = ''
  const displayName = form.name.trim() || 'New project'

  if (isAuthenticated.value) {
    const token = getAuthToken()
    if (!token) {
      createError.value = 'Session expired — sign in again.'
      return
    }
    creating.value = true
    try {
      const res = await $fetch<{ project: import('~/types/creative-project').CreativeProject }>(
        '/api/projects/create',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: {
            name: displayName,
            aspectRatio: form.aspectRatio,
            goal: form.goal,
            workflowMode: form.workflowMode
          }
        }
      )
      writeSessionWorkflow(res.project.id, res.project.workflowMode || form.workflowMode)
      registerImportedProject(res.project)
      openCreate.value = false
      toast.showToast('Project created.', 'success')
      await navigateTo(`/projects/${res.project.id}/home`)
    } catch (e: unknown) {
      createError.value =
        (e as { data?: { message?: string } })?.data?.message ||
        (e instanceof Error ? e.message : '') ||
        'Could not create project.'
    } finally {
      creating.value = false
    }
    return
  }

  const p = createProject({
    name: displayName,
    aspectRatio: form.aspectRatio,
    goal: form.goal,
    workflowMode: form.workflowMode
  })
  writeSessionWorkflow(p.id, p.workflowMode || form.workflowMode)
  openCreate.value = false
  await navigateTo(`/projects/${p.id}/home`)
}
</script>
