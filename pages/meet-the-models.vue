<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <div class="mb-12">
      <h1 class="text-4xl font-bold text-gray-900 mb-4">Meet the Models</h1>
      <p class="text-xl text-gray-600">Explore the powerful AI models available on our platform</p>
    </div>

    <!-- AI Model Leaderboard -->
    <div class="mb-12">
      <h2 class="text-2xl font-semibold text-gray-900 mb-6">AI Model Leaderboard</h2>
      <p class="text-gray-600 mb-6">See which AI models are performing best based on user ratings</p>
      
      <div v-if="leaderboardLoading" class="text-gray-600">Loading leaderboard...</div>
      
      <div v-else-if="modelLeaderboard.length > 0" class="bg-white border border-gray-200 border border-gray-200 rounded-xl overflow-hidden">
        <div
          v-for="(entry, index) in modelLeaderboard"
          :key="entry.model"
          class="flex items-center justify-between p-6 border-b border-gray-200 last:border-b-0 hover:bg-gray-100 transition-colors"
        >
          <div class="flex items-center gap-6 flex-1">
            <!-- Rank Badge -->
            <div class="text-2xl font-bold text-gray-600 w-12 text-center">
              {{ index + 1 }}
              <span v-if="index === 0" class="text-yellow-400">🥇</span>
              <span v-else-if="index === 1" class="text-gray-600">🥈</span>
              <span v-else-if="index === 2" class="text-amber-600">🥉</span>
            </div>

            <!-- Model Avatar -->
            <div class="w-16 h-16 rounded-lg bg-white border border-gray-300 flex items-center justify-center flex-shrink-0 p-2">
              <img
                v-if="getModelIcon(entry.model)"
                :src="getModelIcon(entry.model)"
                :alt="entry.model"
                class="w-full h-full object-contain"
              />
              <div v-else class="text-gray-500 text-sm font-bold">
                {{ entry.model[0] }}
              </div>
            </div>

            <!-- Model Name -->
            <div class="flex-1">
              <h3 class="text-xl font-semibold text-gray-900">{{ entry.model }}</h3>
              <p class="text-sm text-gray-600">Average Rating: {{ entry.averageRating.toFixed(1) }}</p>
            </div>
          </div>

          <!-- Stats -->
          <div class="text-right flex-shrink-0">
            <div class="flex items-center gap-6">
              <div>
                <div class="text-2xl font-bold text-gray-900">{{ entry.averageRating.toFixed(1) }}</div>
                <div class="text-xs text-gray-500">Avg Rating</div>
              </div>
              <div>
                <div class="text-2xl font-bold text-gray-900">{{ entry.voteCount }}</div>
                <div class="text-xs text-gray-500">Votes</div>
              </div>
              <div>
                <div class="text-2xl font-bold text-accent-cyan">{{ entry.totalScore }}</div>
                <div class="text-xs text-gray-500">Total Score</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="text-gray-600 text-center py-12">
        No ratings yet. Be the first to rate an AI response!
      </div>
    </div>

    <!-- All Models Grid -->
    <div>
      <h2 class="text-2xl font-semibold text-gray-900 mb-6">All Models</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <ModelInfoCard
          v-for="model in models"
          :key="model.name"
          :model="model"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import chatgptIcon from '~/assets/icons/chatgpt.svg'
import claudeIcon from '~/assets/icons/claude.svg'
import geminiIcon from '~/assets/icons/gemini.svg'
import mistralIcon from '~/assets/icons/mistral.svg'
import deepseekIcon from '~/assets/icons/deepseek.svg'
import llamaIcon from '~/assets/icons/llama.svg'
import grokIcon from '~/assets/icons/grok.svg'
import perplexityIcon from '~/assets/icons/perplexity.svg'

const iconMap = {
  'ChatGPT': chatgptIcon,
  'Claude': claudeIcon,
  'Gemini': geminiIcon,
  'Mistral': mistralIcon,
  'DeepSeek': deepseekIcon,
  'LLaMA': llamaIcon,
  'Grok': grokIcon,
  'Perplexity': perplexityIcon,
}

const modelLeaderboard = ref([])
const leaderboardLoading = ref(true)

const getModelIcon = (modelName: string) => {
  return iconMap[modelName as keyof typeof iconMap] || null
}

onMounted(async () => {
  try {
    const leaderboard = await $fetch('/api/models/leaderboard')
    modelLeaderboard.value = leaderboard
  } catch (error) {
    console.error('Error fetching model leaderboard:', error)
  } finally {
    leaderboardLoading.value = false
  }
})

const models = [
  {
    name: 'ChatGPT',
    icon: iconMap['ChatGPT'],
    description: "OpenAI's advanced language model with deep reasoning capabilities",
    capabilities: ['Text Generation', 'Code Writing', 'Creative Writing', 'Analysis'],
    status: 'Available'
  },
  {
    name: 'Claude',
    icon: iconMap['Claude'],
    description: "Anthropic's AI assistant focused on helpful, harmless, and honest responses",
    capabilities: ['Reasoning', 'Writing', 'Analysis', 'Safety'],
    status: 'Available'
  },
  {
    name: 'Gemini',
    icon: iconMap['Gemini'],
    description: "Google's multimodal AI model with advanced reasoning and creativity",
    capabilities: ['Multimodal', 'Reasoning', 'Creativity', 'Analysis'],
    status: 'Available'
  },
  {
    name: 'Mistral',
    icon: iconMap['Mistral'],
    description: 'High-performance open-source language model with excellent reasoning',
    capabilities: ['Open Source', 'Reasoning', 'Efficiency', 'Multilingual'],
    status: 'Available'
  },
  {
    name: 'DeepSeek',
    icon: iconMap['DeepSeek'],
    description: 'Advanced reasoning and coding-focused AI model',
    capabilities: ['Coding', 'Reasoning', 'Mathematics', 'Analysis'],
    status: 'Available'
  },
  {
    name: 'LLaMA',
    icon: iconMap['LLaMA'],
    description: "Meta's open-source large language model family",
    capabilities: ['Open Source', 'Customizable', 'Efficient', 'Multilingual'],
    status: 'Available'
  },
  {
    name: 'Grok',
    icon: iconMap['Grok'],
    description: "xAI's AI model with real-time knowledge and humor",
    capabilities: ['Real-time Knowledge', 'Humor', 'Reasoning', 'Creativity'],
    status: 'Available'
  },
  {
    name: 'Perplexity',
    icon: iconMap['Perplexity'],
    description: 'AI-powered search engine with conversational interface',
    capabilities: ['Search', 'Research', 'Citations', 'Real-time Data'],
    status: 'Available'
  }
]
</script>

