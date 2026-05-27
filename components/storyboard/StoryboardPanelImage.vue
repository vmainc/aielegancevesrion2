<script setup lang="ts">
import {
  fetchImageAsDataUrl,
  isDirectStoryboardFrameSrc
} from '~/lib/storyboard-frame-preview-url'
import { appendPlaybackAccessToken, isProjectAssetMediaPath, projectAssetMediaPathOnly } from '~/lib/project-asset-playback-url'

const props = defineProps<{
  src: string
  alt?: string
}>()

const emit = defineEmits<{
  error: []
}>()

const { getAuthToken } = useAuth()
const displaySrc = ref('')
const loading = ref(false)

function authHeaders (): Record<string, string> | undefined {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : undefined
}

async function resolveSrc (raw: string) {
  const u = raw.trim()
  displaySrc.value = ''
  if (!u) return
  if (u.startsWith('data:image/')) {
    displaySrc.value = u
    return
  }
  let fetchUrl = u
  const pathOnly = projectAssetMediaPathOnly(u)
  if (isProjectAssetMediaPath(pathOnly) && !/[?&]access_token=/.test(u)) {
    fetchUrl = appendPlaybackAccessToken(pathOnly, getAuthToken())
  }
  if (isDirectStoryboardFrameSrc(fetchUrl)) {
    displaySrc.value = fetchUrl
    return
  }
  loading.value = true
  try {
    displaySrc.value = await fetchImageAsDataUrl(fetchUrl, { headers: authHeaders() })
  } catch {
    displaySrc.value = fetchUrl
    emit('error')
  } finally {
    loading.value = false
  }
}

watch(
  () => props.src,
  (u) => {
    void resolveSrc(u || '')
  },
  { immediate: true }
)
</script>

<template>
  <img
    v-if="displaySrc && !loading"
    :src="displaySrc"
    :alt="alt || ''"
    class="absolute inset-0 w-full h-full object-contain object-center pointer-events-none"
    loading="eager"
    @error="emit('error')"
  >
</template>
