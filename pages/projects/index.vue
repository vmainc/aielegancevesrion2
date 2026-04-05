<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
    <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 sm:mb-10">
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Projects</h1>
        <p class="text-gray-600 text-sm sm:text-base max-w-xl">
          Start a guided workflow: overview, director bible, story, characters, storyboard, then video. Import a Final Draft (.fdx), plain text (.txt), or text-based PDF to seed scenes and characters in PocketBase.
        </p>
      </div>
      <button
        type="button"
        class="shrink-0 px-5 py-2.5 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg transition-colors"
        @click="openCreateModal('blank')"
      >
        Create New Project
      </button>
    </div>

    <div v-if="!clientReady" class="text-gray-600 py-12">Loading projects…</div>

    <div v-else-if="projects.length === 0" class="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
      <p class="text-gray-700 mb-2 font-medium">No projects yet</p>
      <p class="text-sm text-gray-500 mb-6">Create a blank project or import a script (.fdx, .txt, or .pdf). Script import requires an account.</p>
      <button
        type="button"
        class="px-5 py-2.5 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg transition-colors"
        @click="openCreateModal('blank')"
      >
        Get started
      </button>
    </div>

    <ul v-else class="grid gap-4 sm:grid-cols-2">
      <li v-for="p in projects" :key="p.id">
        <NuxtLink
          :to="`/projects/${p.id}/overview`"
          class="block rounded-xl border border-gray-200 bg-white shadow-sm hover:border-primary/50 hover:bg-gray-50 transition-all p-5 h-full"
        >
          <div class="flex items-start justify-between gap-3 mb-3">
            <h2 class="text-lg font-semibold text-gray-900">{{ p.name }}</h2>
            <span class="shrink-0 text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-700">{{ p.aspectRatio }}</span>
          </div>
          <p class="text-sm text-gray-500 line-clamp-2 mb-3">
            {{ p.synopsis || 'No synopsis yet — start in Overview.' }}
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
          <h2 id="create-project-title" class="text-lg font-semibold text-gray-900 mb-4">New project</h2>

          <div class="flex rounded-lg border border-gray-200 p-0.5 mb-4">
            <button
              type="button"
              class="flex-1 py-2 text-sm font-medium rounded-md transition-colors"
              :class="createMode === 'blank' ? 'bg-primary text-gray-950' : 'text-gray-600 hover:text-gray-800'"
              @click="createMode = 'blank'"
            >
              Blank
            </button>
            <button
              type="button"
              class="flex-1 py-2 text-sm font-medium rounded-md transition-colors"
              :class="createMode === 'import' ? 'bg-primary text-gray-950' : 'text-gray-600 hover:text-gray-800'"
              @click="createMode = 'import'"
            >
              Import script
            </button>
          </div>

          <div v-if="createMode === 'import' && !isAuthenticated" class="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900">
            <NuxtLink to="/login" class="underline font-medium">Log in</NuxtLink> to import a script — files are parsed on the server and saved to your account.
          </div>

          <form class="space-y-4" @submit.prevent="submitCreate">
            <div>
              <label for="proj-name" class="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                id="proj-name"
                v-model="form.name"
                type="text"
                :required="createMode === 'blank'"
                class="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 focus:outline-none focus:border-primary"
                placeholder="e.g. My screenplay"
              >
            </div>

            <div v-if="createMode === 'import'" class="space-y-2">
              <label for="script-file" class="block text-sm font-medium text-gray-700">Script file</label>
              <input
                id="script-file"
                ref="fileInput"
                type="file"
                accept=".fdx,.txt,.pdf,application/xml,text/xml,text/plain,application/pdf"
                class="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-gray-200 file:text-gray-900"
                @change="onFileChange"
              >
              <p class="text-xs text-gray-500">Final Draft (.fdx), plain text (.txt), or text-based PDF. Scanned image-only PDFs are not supported.</p>
            </div>

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
                <option value="social">Social</option>
                <option value="commercial">Commercial</option>
                <option value="other">Other</option>
              </select>
            </div>

            <p v-if="importError" class="text-sm text-red-400">{{ importError }}</p>

            <div class="flex gap-2 justify-end pt-2">
              <button
                type="button"
                class="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                :disabled="importing"
                @click="closeModal"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="importing"
                class="px-4 py-2 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[8rem]"
              >
                {{ importing ? 'Analyzing script…' : submitLabel }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { ProjectAspectRatio, ProjectGoal } from '~/types/creative-project'

const { projects, createProject, clientReady, registerImportedProject } = useCreativeProject()
const { isAuthenticated, getAuthToken } = useAuth()
const toast = useToast()
const route = useRoute()
const router = useRouter()

const openCreate = ref(false)
const createMode = ref<'blank' | 'import'>('blank')
const createModalIntent = ref<'blank' | 'import'>('blank')
const scriptFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const importing = ref(false)
const importError = ref('')

const form = reactive({
  name: '',
  aspectRatio: '16:9' as ProjectAspectRatio,
  goal: 'film' as ProjectGoal
})

const submitLabel = computed(() =>
  createMode.value === 'import' ? 'Import & open' : 'Create & open'
)

function openCreateModal (mode: 'blank' | 'import') {
  createModalIntent.value = mode
  openCreate.value = true
}

function closeModal () {
  if (importing.value) return
  openCreate.value = false
}

function onFileChange (e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  scriptFile.value = f || null
  importError.value = ''
}

watch(openCreate, (v) => {
  if (!v) return
  const fromQuery = route.query.import === '1' || route.query.import === 'true'
  createMode.value = fromQuery ? 'import' : createModalIntent.value
  form.name = ''
  form.aspectRatio = '16:9'
  form.goal = 'film'
  scriptFile.value = null
  importError.value = ''
  if (fileInput.value) fileInput.value.value = ''
  if (fromQuery) {
    router.replace({ path: '/projects', query: {} })
  }
})

onMounted(() => {
  if (route.query.import === '1' || route.query.import === 'true') {
    createModalIntent.value = 'import'
    openCreate.value = true
  }
})

async function submitCreate () {
  importError.value = ''
  if (createMode.value === 'blank') {
    if (!form.name.trim()) {
      importError.value = 'Enter a project name.'
      return
    }
    const p = createProject({
      name: form.name,
      aspectRatio: form.aspectRatio,
      goal: form.goal
    })
    openCreate.value = false
    await navigateTo(`/projects/${p.id}/overview`)
    return
  }

  if (!isAuthenticated.value) {
    importError.value = 'Log in to import a script.'
    return
  }
  if (!scriptFile.value) {
    importError.value = 'Choose a .fdx, .txt, or .pdf file.'
    return
  }

  const token = getAuthToken()
  if (!token) {
    importError.value = 'Session expired — log in again.'
    return
  }

  importing.value = true
  try {
    const fd = new FormData()
    fd.append('file', scriptFile.value)
    fd.append('name', form.name.trim())
    fd.append('aspectRatio', form.aspectRatio)
    fd.append('goal', form.goal)

    const res = await $fetch<{ project: import('~/types/creative-project').CreativeProject }>(
      '/api/projects/import-script',
      {
        method: 'POST',
        body: fd,
        headers: { Authorization: `Bearer ${token}` }
      }
    )
    registerImportedProject(res.project)
    openCreate.value = false
    toast.showToast('Script imported — opening overview.', 'success')
    await navigateTo(`/projects/${res.project.id}/overview`)
  } catch (e: any) {
    importError.value =
      e?.data?.message || e?.data?.statusMessage || e?.message || 'Import failed. Try again.'
  } finally {
    importing.value = false
  }
}
</script>
