<template>
  <div class="min-h-screen flex flex-col bg-white">
    <nav class="shrink-0 bg-white border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-20">
          <!-- Logo -->
          <div class="flex items-center space-x-4 lg:space-x-10">
            <NuxtLink to="/" class="flex items-center">
              <img
                :src="logo"
                alt="AI Elegance"
                class="h-12 sm:h-14 w-auto rounded-md shadow-sm"
              />
            </NuxtLink>
            <!-- Desktop: workspace nav (logged in) or marketing anchors (guest) -->
            <ClientOnly>
              <div v-if="isAuthenticated" class="hidden lg:flex items-center space-x-8">
                <NuxtLink
                  to="/projects"
                  class="text-gray-700 hover:text-primary transition-colors text-base font-medium"
                >
                  Workflow
                </NuxtLink>
                <div ref="assetsMenuRef" class="relative">
                  <button
                    type="button"
                    @click.stop="toggleAssetsDropdown"
                    class="flex items-center gap-1 text-gray-700 hover:text-primary transition-colors text-base font-medium"
                    :aria-expanded="assetsDropdownOpen"
                    aria-haspopup="true"
                    aria-label="Assets menu"
                  >
                    Assets
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div
                    v-if="assetsDropdownOpen"
                    class="absolute left-0 top-full mt-2 min-w-[12rem] bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1"
                  >
                    <NuxtLink
                      to="/assets"
                      class="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary transition-colors rounded-t-lg"
                      @click="closeAssetsDropdown"
                    >
                      Overview
                    </NuxtLink>
                    <NuxtLink
                      to="/assets/scripts"
                      class="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary transition-colors"
                      @click="closeAssetsDropdown"
                    >
                      Scripts
                    </NuxtLink>
                    <NuxtLink
                      to="/assets/characters"
                      class="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary transition-colors"
                      @click="closeAssetsDropdown"
                    >
                      Characters
                    </NuxtLink>
                    <NuxtLink
                      to="/assets/storyboards"
                      class="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary transition-colors"
                      @click="closeAssetsDropdown"
                    >
                      Storyboards
                    </NuxtLink>
                    <NuxtLink
                      to="/assets/video"
                      class="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary transition-colors rounded-b-lg"
                      @click="closeAssetsDropdown"
                    >
                      Video
                    </NuxtLink>
                  </div>
                </div>
                <div ref="toolsMenuRef" class="relative">
                  <button
                    type="button"
                    @click.stop="toggleToolsDropdown"
                    class="flex items-center gap-1 text-gray-700 hover:text-primary transition-colors text-base font-medium"
                    :aria-expanded="toolsDropdownOpen"
                    aria-haspopup="true"
                    aria-label="Tools menu"
                  >
                    Tools
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div
                    v-if="toolsDropdownOpen"
                    class="absolute left-0 top-full mt-2 min-w-[14rem] bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1"
                  >
                    <NuxtLink
                      to="/tools"
                      class="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary transition-colors rounded-t-lg"
                      @click="closeToolsDropdown"
                    >
                      Overview
                    </NuxtLink>
                    <NuxtLink
                      to="/tools/script-wizard"
                      class="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary transition-colors"
                      @click="closeToolsDropdown"
                    >
                      Script Wizard
                    </NuxtLink>
                    <NuxtLink
                      to="/character-creator"
                      class="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary transition-colors"
                      @click="closeToolsDropdown"
                    >
                      Character Creator
                    </NuxtLink>
                    <NuxtLink
                      to="/tools/video-generation"
                      class="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary transition-colors rounded-b-lg"
                      @click="closeToolsDropdown"
                    >
                      Video generation
                    </NuxtLink>
                  </div>
                </div>
              </div>
              <div v-else class="hidden lg:flex items-center space-x-8">
                <NuxtLink
                  to="/#capabilities"
                  class="text-gray-700 hover:text-primary transition-colors text-base font-medium"
                >
                  Capabilities
                </NuxtLink>
                <NuxtLink
                  to="/#how-it-works"
                  class="text-gray-700 hover:text-primary transition-colors text-base font-medium"
                >
                  How it works
                </NuxtLink>
                <NuxtLink
                  to="/#compare"
                  class="text-gray-700 hover:text-primary transition-colors text-base font-medium"
                >
                  Compare AI
                </NuxtLink>
                <NuxtLink
                  to="/#workflow"
                  class="text-gray-700 hover:text-primary transition-colors text-base font-medium"
                >
                  Workflow
                </NuxtLink>
              </div>
              <template #fallback>
                <div class="hidden lg:flex items-center space-x-8">
                  <NuxtLink
                    to="/#capabilities"
                    class="text-gray-700 hover:text-primary transition-colors text-base font-medium"
                  >
                    Capabilities
                  </NuxtLink>
                  <NuxtLink
                    to="/#how-it-works"
                    class="text-gray-700 hover:text-primary transition-colors text-base font-medium"
                  >
                    How it works
                  </NuxtLink>
                  <NuxtLink
                    to="/#compare"
                    class="text-gray-700 hover:text-primary transition-colors text-base font-medium"
                  >
                    Compare AI
                  </NuxtLink>
                  <NuxtLink
                    to="/#workflow"
                    class="text-gray-700 hover:text-primary transition-colors text-base font-medium"
                  >
                    Workflow
                  </NuxtLink>
                </div>
              </template>
            </ClientOnly>
          </div>
          <!-- Mobile menu + auth -->
          <div class="flex items-center space-x-2 sm:space-x-4">
            <button
              @click.stop="toggleMobileMenu"
              class="lg:hidden p-2 text-gray-700 hover:text-primary transition-colors rounded-lg hover:bg-gray-100"
              aria-label="Toggle menu"
            >
              <svg
                v-if="!mobileMenuOpen"
                class="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <svg
                v-else
                class="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <ClientOnly>
              <div class="flex items-center space-x-2 sm:space-x-4">
                <template v-if="isAuthenticated">
                  <div class="relative">
                    <button
                      @click="toggleDropdown"
                      class="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 text-gray-700 hover:text-primary transition-colors rounded-lg hover:bg-gray-100"
                      aria-label="Account"
                    >
                      <svg
                        class="w-5 h-5 sm:w-6 sm:h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                      <span v-if="userFirstName" class="hidden sm:inline text-sm font-medium text-gray-700">
                        {{ userFirstName }}
                      </span>
                    </button>
                    <div
                      v-if="dropdownOpen"
                      ref="dropdownRef"
                      class="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50"
                    >
                      <NuxtLink
                        to="/projects"
                        @click="closeDropdown"
                        class="block px-4 py-3 text-gray-700 hover:bg-gray-50 hover:text-primary transition-colors first:rounded-t-lg"
                      >
                        My Projects
                      </NuxtLink>
                      <NuxtLink
                        to="/account"
                        @click="closeDropdown"
                        class="block px-4 py-3 text-gray-700 hover:bg-gray-50 hover:text-primary transition-colors"
                      >
                        Settings
                      </NuxtLink>
                      <button
                        @click="handleLogout"
                        class="w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-50 hover:text-red-600 transition-colors last:rounded-b-lg"
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                </template>
                <template v-else>
                  <NuxtLink
                    to="/login"
                    class="hidden sm:block text-gray-700 hover:text-primary transition-colors text-base font-medium"
                  >
                    Login
                  </NuxtLink>
                  <NuxtLink
                    to="/signup"
                    class="px-3 sm:px-4 py-2 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg transition-colors text-sm sm:text-base"
                  >
                    Sign Up
                  </NuxtLink>
                </template>
              </div>
              <template #fallback>
                <div class="flex items-center space-x-4">
                  <NuxtLink
                    to="/login"
                    class="text-gray-700 hover:text-primary transition-colors text-base font-medium"
                  >
                    Login
                  </NuxtLink>
                  <NuxtLink
                    to="/signup"
                    class="px-4 py-2 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg transition-colors"
                  >
                    Sign Up
                  </NuxtLink>
                </div>
              </template>
            </ClientOnly>
          </div>
        </div>
      </div>

      <!-- Mobile Menu -->
      <Transition
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0 -translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-2"
      >
        <div
          v-if="mobileMenuOpen"
          ref="mobileMenuRef"
          class="lg:hidden border-t border-gray-200 bg-white"
        >
          <div class="px-4 py-4 space-y-2">
            <ClientOnly>
              <template v-if="isAuthenticated">
                <NuxtLink
                  to="/projects"
                  @click="closeMobileMenu"
                  class="block px-4 py-3.5 text-gray-700 hover:text-primary hover:bg-gray-50 active:bg-gray-50 transition-colors rounded-lg font-medium"
                >
                  Workflow
                </NuxtLink>
                <div class="rounded-lg border border-gray-200 overflow-hidden">
                  <NuxtLink
                    to="/assets"
                    @click="closeMobileMenu"
                    class="block px-4 py-3.5 text-gray-900 font-medium bg-gray-50 border-b border-gray-200"
                  >
                    Assets
                  </NuxtLink>
                  <NuxtLink
                    to="/assets/scripts"
                    @click="closeMobileMenu"
                    class="block pl-8 pr-4 py-3 text-sm text-gray-600 hover:text-primary hover:bg-gray-50 transition-colors"
                  >
                    Scripts
                  </NuxtLink>
                  <NuxtLink
                    to="/assets/characters"
                    @click="closeMobileMenu"
                    class="block pl-8 pr-4 py-3 text-sm text-gray-600 hover:text-primary hover:bg-gray-50 transition-colors"
                  >
                    Characters
                  </NuxtLink>
                  <NuxtLink
                    to="/assets/storyboards"
                    @click="closeMobileMenu"
                    class="block pl-8 pr-4 py-3 text-sm text-gray-600 hover:text-primary hover:bg-gray-50 transition-colors"
                  >
                    Storyboards
                  </NuxtLink>
                  <NuxtLink
                    to="/assets/video"
                    @click="closeMobileMenu"
                    class="block pl-8 pr-4 py-3 text-sm text-gray-600 hover:text-primary hover:bg-gray-50 transition-colors"
                  >
                    Video
                  </NuxtLink>
                </div>
                <div class="rounded-lg border border-gray-200 overflow-hidden">
                  <NuxtLink
                    to="/tools"
                    @click="closeMobileMenu"
                    class="block px-4 py-3.5 text-gray-900 font-medium bg-gray-50 border-b border-gray-200"
                  >
                    Tools
                  </NuxtLink>
                  <NuxtLink
                    to="/character-creator"
                    @click="closeMobileMenu"
                    class="block pl-8 pr-4 py-3 text-sm text-gray-600 hover:text-primary hover:bg-gray-50 transition-colors"
                  >
                    Character Creator
                  </NuxtLink>
                  <NuxtLink
                    to="/tools/script-wizard"
                    @click="closeMobileMenu"
                    class="block pl-8 pr-4 py-3 text-sm text-gray-600 hover:text-primary hover:bg-gray-50 transition-colors"
                  >
                    Script Wizard
                  </NuxtLink>
                  <NuxtLink
                    to="/tools/video-generation"
                    @click="closeMobileMenu"
                    class="block pl-8 pr-4 py-3 text-sm text-gray-600 hover:text-primary hover:bg-gray-50 transition-colors"
                  >
                    Video generation
                  </NuxtLink>
                </div>
                <NuxtLink
                  to="/account"
                  @click="closeMobileMenu"
                  class="block px-4 py-3.5 text-gray-700 hover:text-primary hover:bg-gray-50 transition-colors rounded-lg font-medium"
                >
                  Settings
                </NuxtLink>
              </template>
              <template v-else>
                <NuxtLink
                  to="/#capabilities"
                  @click="closeMobileMenu"
                  class="block px-4 py-3.5 text-gray-700 hover:text-primary hover:bg-gray-50 transition-colors rounded-lg font-medium"
                >
                  Capabilities
                </NuxtLink>
                <NuxtLink
                  to="/#how-it-works"
                  @click="closeMobileMenu"
                  class="block px-4 py-3.5 text-gray-700 hover:text-primary hover:bg-gray-50 transition-colors rounded-lg font-medium"
                >
                  How it works
                </NuxtLink>
                <NuxtLink
                  to="/#compare"
                  @click="closeMobileMenu"
                  class="block px-4 py-3.5 text-gray-700 hover:text-primary hover:bg-gray-50 transition-colors rounded-lg font-medium"
                >
                  Compare AI
                </NuxtLink>
                <NuxtLink
                  to="/#workflow"
                  @click="closeMobileMenu"
                  class="block px-4 py-3.5 text-gray-700 hover:text-primary hover:bg-gray-50 transition-colors rounded-lg font-medium"
                >
                  Workflow
                </NuxtLink>
              </template>
              <template #fallback>
                <NuxtLink
                  to="/#capabilities"
                  @click="closeMobileMenu"
                  class="block px-4 py-3.5 text-gray-700 hover:text-primary hover:bg-gray-50 transition-colors rounded-lg font-medium"
                >
                  Capabilities
                </NuxtLink>
                <NuxtLink
                  to="/#how-it-works"
                  @click="closeMobileMenu"
                  class="block px-4 py-3.5 text-gray-700 hover:text-primary hover:bg-gray-50 transition-colors rounded-lg font-medium"
                >
                  How it works
                </NuxtLink>
                <NuxtLink
                  to="/#compare"
                  @click="closeMobileMenu"
                  class="block px-4 py-3.5 text-gray-700 hover:text-primary hover:bg-gray-50 transition-colors rounded-lg font-medium"
                >
                  Compare AI
                </NuxtLink>
                <NuxtLink
                  to="/#workflow"
                  @click="closeMobileMenu"
                  class="block px-4 py-3.5 text-gray-700 hover:text-primary hover:bg-gray-50 transition-colors rounded-lg font-medium"
                >
                  Workflow
                </NuxtLink>
              </template>
            </ClientOnly>
            <ClientOnly>
              <template v-if="!isAuthenticated">
                <div class="pt-2 border-t border-gray-200 mt-2">
                  <NuxtLink
                    to="/login"
                    @click="closeMobileMenu"
                    class="block px-4 py-3.5 text-gray-700 hover:text-primary hover:bg-gray-50 transition-colors rounded-lg mb-2 font-medium"
                  >
                    Login
                  </NuxtLink>
                  <NuxtLink
                    to="/signup"
                    @click="closeMobileMenu"
                    class="block px-4 py-3.5 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg transition-colors text-center"
                  >
                    Sign Up
                  </NuxtLink>
                </div>
              </template>
            </ClientOnly>
          </div>
        </div>
      </Transition>
    </nav>
    <main class="flex-1 bg-white text-gray-900">
      <slot />
    </main>
  </div>
</template>

<script setup>
import logo from '~/assets/img/logo.png'

const { isAuthenticated, logout, user } = useAuth()

const dropdownOpen = ref(false)
const dropdownRef = ref(null)
const assetsDropdownOpen = ref(false)
const assetsMenuRef = ref(null)
const toolsDropdownOpen = ref(false)
const toolsMenuRef = ref(null)
const mobileMenuOpen = ref(false)
const mobileMenuRef = ref(null)

const userFirstName = computed(() => {
  if (!user.value?.name) return null
  return user.value.name.split(' ')[0]
})

const toggleDropdown = () => {
  if (assetsDropdownOpen.value) assetsDropdownOpen.value = false
  if (toolsDropdownOpen.value) toolsDropdownOpen.value = false
  dropdownOpen.value = !dropdownOpen.value
}

const closeDropdown = () => {
  dropdownOpen.value = false
}

const toggleAssetsDropdown = () => {
  if (dropdownOpen.value) dropdownOpen.value = false
  if (toolsDropdownOpen.value) toolsDropdownOpen.value = false
  assetsDropdownOpen.value = !assetsDropdownOpen.value
}

const closeAssetsDropdown = () => {
  assetsDropdownOpen.value = false
}

const toggleToolsDropdown = () => {
  if (dropdownOpen.value) dropdownOpen.value = false
  if (assetsDropdownOpen.value) assetsDropdownOpen.value = false
  toolsDropdownOpen.value = !toolsDropdownOpen.value
}

const closeToolsDropdown = () => {
  toolsDropdownOpen.value = false
}

const toggleMobileMenu = () => {
  mobileMenuOpen.value = !mobileMenuOpen.value
  if (dropdownOpen.value) {
    dropdownOpen.value = false
  }
  if (assetsDropdownOpen.value) {
    assetsDropdownOpen.value = false
  }
  if (toolsDropdownOpen.value) {
    toolsDropdownOpen.value = false
  }
}

const closeMobileMenu = () => {
  mobileMenuOpen.value = false
}

const handleLogout = () => {
  closeDropdown()
  logout()
}

const handleClickOutside = (event) => {
  if (dropdownOpen.value && dropdownRef.value && !dropdownRef.value.contains(event.target)) {
    const button = event.target.closest('button[aria-label="Account"]')
    if (!button) {
      closeDropdown()
    }
  }
  if (assetsDropdownOpen.value && assetsMenuRef.value && !assetsMenuRef.value.contains(event.target)) {
    closeAssetsDropdown()
  }
  if (toolsDropdownOpen.value && toolsMenuRef.value && !toolsMenuRef.value.contains(event.target)) {
    closeToolsDropdown()
  }
  if (mobileMenuOpen.value) {
    const mobileMenuButton = event.target.closest('button[aria-label="Toggle menu"]')
    if (mobileMenuButton) {
      return
    }
    if (mobileMenuRef.value && !mobileMenuRef.value.contains(event.target)) {
      closeMobileMenu()
    }
  }
}

onMounted(() => {
  setTimeout(() => {
    document.addEventListener('click', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
  }, 100)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('touchstart', handleClickOutside)
})
</script>
