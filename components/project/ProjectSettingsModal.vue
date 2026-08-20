<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="proj-settings-title"
      @click.self="close"
    >
      <div
        class="w-full max-w-md rounded-xl border border-gray-200 bg-studio-slate shadow-xl max-h-[90vh] overflow-y-auto"
        @click.stop
      >
        <div class="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-200">
          <h2 id="proj-settings-title" class="text-lg font-semibold text-gray-900">
            Project settings
          </h2>
          <button
            type="button"
            class="p-2 rounded-lg text-gray-600 hover:text-gray-800 hover:bg-gray-200/60 transition-colors"
            aria-label="Close"
            @click="close"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="px-5 py-4 space-y-5">
          <div>
            <h3 class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Stats</h3>
            <dl class="grid grid-cols-2 gap-3 text-sm">
              <div class="rounded-lg bg-studio-slate border border-gray-300 px-3 py-2">
                <dt class="text-gray-500">Scenes</dt>
                <dd class="text-lg font-semibold text-gray-900">{{ stats.sceneCount }}</dd>
              </div>
              <div class="rounded-lg bg-studio-slate border border-gray-300 px-3 py-2">
                <dt class="text-gray-500">Characters</dt>
                <dd class="text-lg font-semibold text-gray-900">{{ stats.characterCount }}</dd>
              </div>
              <div class="rounded-lg bg-studio-slate border border-gray-300 px-3 py-2 col-span-2">
                <dt class="text-gray-500">Storage</dt>
                <dd class="text-gray-800">{{ isCloud ? 'Cloud (account)' : 'This device only' }}</dd>
              </div>
              <div class="rounded-lg bg-studio-slate border border-gray-300 px-3 py-2 col-span-2">
                <dt class="text-gray-500">Created</dt>
                <dd class="text-gray-800">{{ formatDate(project.createdAt) }}</dd>
              </div>
              <div v-if="project.updatedAt !== project.createdAt" class="rounded-lg bg-studio-slate border border-gray-300 px-3 py-2 col-span-2">
                <dt class="text-gray-500">Updated</dt>
                <dd class="text-gray-800">{{ formatDate(project.updatedAt) }}</dd>
              </div>
            </dl>
          </div>

          <div class="space-y-3">
            <h3 class="text-xs font-medium text-gray-500 uppercase tracking-wide">Share</h3>
            <p v-if="isMember" class="text-sm text-gray-600">
              This project is shared with you. Only the owner can manage members.
            </p>
            <template v-else-if="isCloud">
              <p class="text-sm text-gray-500 mb-2">
                Invite teammates by email. They get full access to this project and all its assets.
              </p>
              <form class="flex gap-2" @submit.prevent="inviteMember">
                <input
                  v-model="inviteEmail"
                  type="email"
                  placeholder="colleague@example.com"
                  class="flex-1 px-3 py-2 rounded-lg bg-studio-slate border border-gray-300 text-gray-900 focus:outline-none focus:border-primary text-sm"
                  :disabled="inviting"
                >
                <button
                  type="submit"
                  class="shrink-0 px-3 py-2 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg text-sm disabled:opacity-50"
                  :disabled="inviting || !inviteEmail.trim()"
                >
                  {{ inviting ? 'Adding…' : 'Add' }}
                </button>
              </form>
              <ul v-if="members.length" class="mt-3 space-y-2">
                <li
                  v-for="m in members"
                  :key="m.id"
                  class="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  <div class="min-w-0">
                    <p class="font-medium text-gray-900 truncate">{{ m.name || m.email }}</p>
                    <p v-if="m.name" class="text-xs text-gray-500 truncate">{{ m.email }}</p>
                  </div>
                  <button
                    type="button"
                    class="shrink-0 text-xs text-red-600 hover:text-red-700"
                    :disabled="removingId === m.userId"
                    @click="removeMember(m.userId)"
                  >
                    {{ removingId === m.userId ? 'Removing…' : 'Remove' }}
                  </button>
                </li>
              </ul>
              <p v-else-if="membersLoaded" class="text-sm text-gray-500">No members yet.</p>
            </template>
          </div>

          <div class="space-y-3">
            <h3 class="text-xs font-medium text-gray-500 uppercase tracking-wide">Edit</h3>
            <div>
              <label for="set-name" class="block text-sm text-gray-600 mb-1">Name</label>
              <input
                id="set-name"
                v-model="draft.name"
                type="text"
                class="w-full px-3 py-2 rounded-lg bg-studio-slate border border-gray-300 text-gray-900 focus:outline-none focus:border-primary"
              >
            </div>
            <div>
              <label for="set-aspect" class="block text-sm text-gray-600 mb-1">Aspect ratio</label>
              <select
                id="set-aspect"
                v-model="draft.aspectRatio"
                class="w-full px-3 py-2 rounded-lg bg-studio-slate border border-gray-300 text-gray-900 focus:outline-none focus:border-primary"
              >
                <option value="16:9">16:9</option>
                <option value="9:16">9:16</option>
                <option value="1:1">1:1</option>
              </select>
            </div>
            <div>
              <label for="set-goal" class="block text-sm text-gray-600 mb-1">Goal</label>
              <select
                id="set-goal"
                v-model="draft.goal"
                class="w-full px-3 py-2 rounded-lg bg-studio-slate border border-gray-300 text-gray-900 focus:outline-none focus:border-primary"
              >
                <option value="film">Film</option>
                <option value="social">Social</option>
                <option value="commercial">Commercial</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label for="set-workflow" class="block text-sm text-gray-600 mb-1">Starting workflow</label>
              <select
                id="set-workflow"
                v-model="draft.workflowMode"
                class="w-full px-3 py-2 rounded-lg bg-studio-slate border border-gray-300 text-gray-900 focus:outline-none focus:border-primary"
              >
                <option value="idea">I have an idea</option>
                <option value="generate">Generate idea with AI</option>
                <option value="import">Import screenplay</option>
              </select>
              <p class="text-xs text-gray-500 mt-1">
                Controls which starting tools appear on Overview (paste idea, AI generation, or script upload).
              </p>
            </div>
            <button
              type="button"
              class="w-full py-2.5 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg transition-colors disabled:opacity-50"
              :disabled="saving"
              @click="saveEdits"
            >
              {{ saving ? 'Saving…' : 'Save changes' }}
            </button>
          </div>

          <div class="pt-2 border-t border-gray-200">
            <h3 class="text-xs font-medium text-red-400/90 uppercase tracking-wide mb-2">Danger zone</h3>
            <p v-if="isMember" class="text-sm text-gray-500 mb-3">
              Only the project owner can delete this project.
            </p>
            <template v-else>
            <p class="text-sm text-gray-500 mb-3">
              Permanently delete this project{{ isCloud ? ' and its scenes & characters in the cloud' : '' }}.
            </p>
            <template v-if="!confirmDelete">
              <button
                type="button"
                class="w-full py-2.5 border border-red-500/50 text-red-400 hover:bg-red-500/10 rounded-lg text-sm font-medium transition-colors"
                @click="confirmDelete = true"
              >
                Delete project…
              </button>
            </template>
            <template v-else>
              <p class="text-sm text-red-700 mb-2">Sure? This cannot be undone.</p>
              <div class="flex gap-2">
                <button
                  type="button"
                  class="flex-1 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100"
                  @click="confirmDelete = false"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  class="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold disabled:opacity-50"
                  :disabled="deleting"
                  @click="runDelete"
                >
                  {{ deleting ? 'Deleting…' : 'Delete' }}
                </button>
              </div>
            </template>
            </template>
          </div>

          <p v-if="errorMsg" class="text-sm text-red-400">{{ errorMsg }}</p>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { normalizeWorkflowMode } from '~/lib/project-workflow-mode'
import type { ProjectMember } from '~/types/project-member'
import type {
  CreativeProject,
  ProjectAspectRatio,
  ProjectGoal,
  ProjectWorkflowMode
} from '~/types/creative-project'

const props = defineProps<{
  open: boolean
  project: CreativeProject
}>()

const emit = defineEmits<{
  'update:open': [boolean]
}>()

const { updateProject, deleteProject } = useCreativeProject()
const { getAuthToken } = useAuth()
const toast = useToast()

const stats = reactive({ sceneCount: 0, characterCount: 0 })
const draft = reactive({
  name: '',
  aspectRatio: '16:9' as ProjectAspectRatio,
  goal: 'film' as ProjectGoal,
  workflowMode: 'import' as ProjectWorkflowMode
})
const saving = ref(false)
const deleting = ref(false)
const confirmDelete = ref(false)
const errorMsg = ref('')
const inviteEmail = ref('')
const inviting = ref(false)
const members = ref<ProjectMember[]>([])
const membersLoaded = ref(false)
const removingId = ref('')

const isCloud = computed(() => props.project.source === 'pocketbase')
const isMember = computed(() => props.project.accessRole === 'member')

function close () {
  emit('update:open', false)
}

function formatDate (iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    })
  } catch {
    return iso
  }
}

function syncDraft () {
  draft.name = props.project.name
  draft.aspectRatio = props.project.aspectRatio
  draft.goal = props.project.goal
  draft.workflowMode = normalizeWorkflowMode(props.project.workflowMode) || 'import'
}

async function loadMembers () {
  const pid = props.project.id
  const token = getAuthToken()
  membersLoaded.value = false
  if (!token || isMember.value || !isCloud.value) {
    members.value = []
    membersLoaded.value = true
    return
  }
  try {
    const res = await $fetch<{ items: ProjectMember[] }>(`/api/projects/${pid}/members`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (props.project.id !== pid) return
    members.value = res.items || []
  } catch {
    if (props.project.id !== pid) return
    members.value = []
  } finally {
    if (props.project.id === pid) membersLoaded.value = true
  }
}

async function inviteMember () {
  errorMsg.value = ''
  const email = inviteEmail.value.trim()
  if (!email) return
  const token = getAuthToken()
  if (!token) return
  inviting.value = true
  try {
    const res = await $fetch<{ member: ProjectMember }>(`/api/projects/${props.project.id}/members`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { email }
    })
    if (res.member) members.value = [...members.value, res.member]
    inviteEmail.value = ''
    toast.showToast('Member added.', 'success')
  } catch (e: any) {
    errorMsg.value = e?.data?.message || e?.message || 'Could not add member.'
  } finally {
    inviting.value = false
  }
}

async function removeMember (userId: string) {
  errorMsg.value = ''
  const token = getAuthToken()
  if (!token) return
  removingId.value = userId
  try {
    await $fetch(`/api/projects/${props.project.id}/members/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    members.value = members.value.filter(m => m.userId !== userId)
    toast.showToast('Member removed.', 'info')
  } catch (e: any) {
    errorMsg.value = e?.data?.message || e?.message || 'Could not remove member.'
  } finally {
    removingId.value = ''
  }
}

async function loadCloudStats () {
  const pid = props.project.id
  const token = getAuthToken()
  if (!token) {
    stats.sceneCount = 0
    stats.characterCount = 0
    return
  }
  try {
    const res = await $fetch<{
      stats: { sceneCount: number; characterCount: number }
    }>(`/api/projects/${pid}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (props.project.id !== pid) return
    stats.sceneCount = res.stats?.sceneCount ?? 0
    stats.characterCount = res.stats?.characterCount ?? 0
  } catch {
    if (props.project.id !== pid) return
    stats.sceneCount = 0
    stats.characterCount = 0
  }
}

watch(
  () => props.open,
  async (v) => {
    errorMsg.value = ''
    confirmDelete.value = false
    if (!v) return
    syncDraft()
    if (isCloud.value) {
      await Promise.all([loadCloudStats(), loadMembers()])
    } else {
      stats.sceneCount = 0
      stats.characterCount = 0
    }
  }
)

watch(
  () => props.project.id,
  async () => {
    if (!props.open || !isCloud.value) return
    syncDraft()
    await Promise.all([loadCloudStats(), loadMembers()])
  }
)

watch(
  () => props.project,
  () => {
    if (props.open) syncDraft()
  },
  { deep: true }
)

async function saveEdits () {
  errorMsg.value = ''
  if (!draft.name.trim()) {
    errorMsg.value = 'Name is required.'
    return
  }
  saving.value = true
  try {
    await updateProject(props.project.id, {
      name: draft.name.trim(),
      aspectRatio: draft.aspectRatio,
      goal: draft.goal,
      workflowMode: draft.workflowMode
    })
    toast.showToast('Project updated.', 'success')
    close()
  } catch (e: any) {
    errorMsg.value = e?.message || 'Save failed.'
  } finally {
    saving.value = false
  }
}

async function runDelete () {
  errorMsg.value = ''
  deleting.value = true
  try {
    await deleteProject(props.project.id)
    toast.showToast('Project deleted.', 'info')
    close()
    await navigateTo('/projects')
  } catch (e: any) {
    errorMsg.value = e?.data?.message || e?.message || 'Delete failed.'
  } finally {
    deleting.value = false
  }
}
</script>
