<template>
  <div class="min-h-screen flex flex-col bg-white">
    <nav class="shrink-0 bg-white border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          class="flex justify-between items-center gap-4 h-[4.5rem] sm:h-20"
        >
          <!-- Logo (left) -->
          <NuxtLink
            :to="showAuthenticatedUi ? '/guide' : '/'"
            class="flex items-center h-full shrink-0"
          >
            <img
              :src="logo"
              alt="AI Elegance"
              class="h-10 sm:h-12 w-auto block"
            />
          </NuxtLink>

          <!-- Menu + account (right) -->
          <div class="flex items-center justify-end h-full gap-1 sm:gap-2 lg:gap-6 shrink-0 min-w-0">
            <ClientOnly>
              <!-- Desktop nav -->
              <div v-if="showAuthenticatedUi" class="hidden lg:flex items-center gap-6">
                <NuxtLink
                  to="/guide"
                  class="inline-flex items-center text-gray-700 hover:text-primary transition-colors text-base font-medium leading-none"
                >
                  Guide
                </NuxtLink>
                <div ref="generateMenuRef" class="relative">
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 text-gray-700 hover:text-primary transition-colors text-base font-medium leading-none"
                    :aria-expanded="generateDropdownOpen"
                    aria-haspopup="true"
                    aria-label="Generate menu"
                    @click.stop="toggleGenerateDropdown"
                  >
                    Generate
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div
                    v-if="generateDropdownOpen"
                    class="absolute right-0 top-full mt-2 min-w-[12rem] bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1"
                  >
                    <NuxtLink
                      to="/tools/video-generation"
                      class="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary transition-colors rounded-t-lg"
                      @click="closeGenerateDropdown"
                    >
                      Video
                    </NuxtLink>
                    <NuxtLink
                      to="/tools/music-generation"
                      class="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary transition-colors"
                      @click="closeGenerateDropdown"
                    >
                      Music
                    </NuxtLink>
                    <NuxtLink
                      to="/character-creator"
                      class="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary transition-colors rounded-b-lg"
                      @click="closeGenerateDropdown"
                    >
                      Character
                    </NuxtLink>
                  </div>
                </div>
                <NuxtLink
                  to="/projects"
                  class="inline-flex items-center text-gray-700 hover:text-primary transition-colors text-base font-medium leading-none"
                >
                  Projects
                </NuxtLink>
                <div ref="assetsMenuRef" class="relative">
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 text-gray-700 hover:text-primary transition-colors text-base font-medium leading-none"
                    :aria-expanded="assetsDropdownOpen"
                    aria-haspopup="true"
                    aria-label="Assets menu"
                    @click.stop="toggleAssetsDropdown"
                  >
                    Assets
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div
                    v-if="assetsDropdownOpen"
                    class="absolute right-0 top-full mt-2 min-w-[12rem] bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1"
                  >
                    <NuxtLink
                      to="/assets/video"
                      class="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary transition-colors rounded-t-lg"
                      @click="closeAssetsDropdown"
                    >
                      My Videos
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
                      to="/assets/music"
                      class="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary transition-colors rounded-b-lg"
                      @click="closeAssetsDropdown"
                    >
                      My Music
                    </NuxtLink>
                  </div>
                </div>
                <div ref="toolsMenuRef" class="relative">
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 text-gray-700 hover:text-primary transition-colors text-base font-medium leading-none"
                    :aria-expanded="toolsDropdownOpen"
                    aria-haspopup="true"
                    aria-label="Tools menu"
                    @click.stop="toggleToolsDropdown"
                  >
                    Tools
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div
                    v-if="toolsDropdownOpen"
                    class="absolute right-0 top-full mt-2 min-w-[14rem] bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1"
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
                      to="/tools/storyboard-builder"
                      class="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary transition-colors rounded-b-lg"
                      @click="closeToolsDropdown"
                    >
                      Storyboard Builder
                    </NuxtLink>
                  </div>
                </div>
              </div>
              <div v-else class="hidden lg:flex items-center gap-6">
                <NuxtLink
                  to="/#capabilities"
                  class="inline-flex items-center text-gray-700 hover:text-primary transition-colors text-base font-medium leading-none"
                >
                  Capabilities
                </NuxtLink>
                <NuxtLink
                  to="/#how-it-works"
                  class="inline-flex items-center text-gray-700 hover:text-primary transition-colors text-base font-medium leading-none"
                >
                  How it works
                </NuxtLink>
                <NuxtLink
                  to="/#compare"
                  class="inline-flex items-center text-gray-700 hover:text-primary transition-colors text-base font-medium leading-none"
                >
                  Compare AI
                </NuxtLink>
                <NuxtLink
                  to="/#workflow"
                  class="inline-flex items-center text-gray-700 hover:text-primary transition-colors text-base font-medium leading-none"
                >
                  Workflow
                </NuxtLink>
              </div>
              <template #fallback>
                <div class="hidden lg:flex items-center gap-6">
                  <NuxtLink
                    to="/#capabilities"
                    class="inline-flex items-center text-gray-700 hover:text-primary transition-colors text-base font-medium leading-none"
                  >
                    Capabilities
                  </NuxtLink>
                  <NuxtLink
                    to="/#how-it-works"
                    class="inline-flex items-center text-gray-700 hover:text-primary transition-colors text-base font-medium leading-none"
                  >
                    How it works
                  </NuxtLink>
                  <NuxtLink
                    to="/#compare"
                    class="inline-flex items-center text-gray-700 hover:text-primary transition-colors text-base font-medium leading-none"
                  >
                    Compare AI
                  </NuxtLink>
                  <NuxtLink
                    to="/#workflow"
                    class="inline-flex items-center text-gray-700 hover:text-primary transition-colors text-base font-medium leading-none"
                  >
                    Workflow
                  </NuxtLink>
                </div>
              </template>
            </ClientOnly>

            <!-- Account / login (part of right menu) -->
            <ClientOnly>
              <div class="flex items-center">
                <template v-if="showAuthenticatedUi">
                  <div ref="accountMenuRef" class="relative hidden lg:flex items-center">
                    <button
                      type="button"
                      class="inline-flex items-center gap-1.5 text-gray-700 hover:text-primary transition-colors text-base font-medium leading-none"
                      :aria-expanded="dropdownOpen"
                      aria-haspopup="true"
                      aria-label="Account"
                      @click.stop="toggleDropdown"
                    >
                      <span>{{ userFirstName || 'Account' }}</span>
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <div
                      v-if="dropdownOpen"
                      ref="dropdownRef"
                      class="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1"
                    >
                      <NuxtLink
                        to="/account"
                        class="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary transition-colors rounded-t-lg"
                        @click="closeDropdown"
                      >
                        Settings
                      </NuxtLink>
                      <button
                        type="button"
                        class="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-red-600 transition-colors rounded-b-lg"
                        @click="handleLogout"
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                </template>
                <template v-else>
                  <NuxtLink
                    to="/login"
                    class="inline-flex items-center justify-center px-3 sm:px-4 py-2 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg transition-colors text-sm sm:text-base leading-none"
                  >
                    Login
                  </NuxtLink>
                </template>
              </div>
              <template #fallback>
                <NuxtLink
                  to="/login"
                  class="hidden lg:inline-flex items-center justify-center px-4 py-2 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg transition-colors leading-none"
                >
                  Login
                </NuxtLink>
              </template>
            </ClientOnly>

            <button
              type="button"
              class="lg:hidden inline-flex items-center justify-center p-2 text-gray-700 hover:text-primary transition-colors rounded-lg hover:bg-gray-100"
              aria-label="Toggle menu"
              @click.stop="toggleMobileMenu"
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
              <template v-if="showAuthenticatedUi">
                <NuxtLink
                  to="/guide"
                  class="block px-4 py-3.5 text-gray-700 hover:text-primary hover:bg-gray-50 active:bg-gray-50 transition-colors rounded-lg font-medium"
                  @click="closeMobileMenu"
                >
                  Guide
                </NuxtLink>
                <div class="rounded-lg border border-gray-200 overflow-hidden">
                  <div class="block px-4 py-3.5 text-gray-900 font-medium bg-gray-50 border-b border-gray-200">
                    Generate
                  </div>
                  <NuxtLink
                    to="/tools/video-generation"
                    class="block pl-8 pr-4 py-3 text-sm text-gray-600 hover:text-primary hover:bg-gray-50 transition-colors"
                    @click="closeMobileMenu"
                  >
                    Video
                  </NuxtLink>
                  <NuxtLink
                    to="/tools/music-generation"
                    class="block pl-8 pr-4 py-3 text-sm text-gray-600 hover:text-primary hover:bg-gray-50 transition-colors"
                    @click="closeMobileMenu"
                  >
                    Music
                  </NuxtLink>
                  <NuxtLink
                    to="/character-creator"
                    class="block pl-8 pr-4 py-3 text-sm text-gray-600 hover:text-primary hover:bg-gray-50 transition-colors"
                    @click="closeMobileMenu"
                  >
                    Character
                  </NuxtLink>
                </div>
                <NuxtLink
                  to="/projects"
                  class="block px-4 py-3.5 text-gray-700 hover:text-primary hover:bg-gray-50 active:bg-gray-50 transition-colors rounded-lg font-medium"
                  @click="closeMobileMenu"
                >
                  Projects
                </NuxtLink>
                <div class="rounded-lg border border-gray-200 overflow-hidden">
                  <div class="block px-4 py-3.5 text-gray-900 font-medium bg-gray-50 border-b border-gray-200">
                    Assets
                  </div>
                  <NuxtLink
                    to="/assets/video"
                    class="block pl-8 pr-4 py-3 text-sm text-gray-600 hover:text-primary hover:bg-gray-50 transition-colors"
                    @click="closeMobileMenu"
                  >
                    My Videos
                  </NuxtLink>
                  <NuxtLink
                    to="/assets/scripts"
                    class="block pl-8 pr-4 py-3 text-sm text-gray-600 hover:text-primary hover:bg-gray-50 transition-colors"
                    @click="closeMobileMenu"
                  >
                    Scripts
                  </NuxtLink>
                  <NuxtLink
                    to="/assets/characters"
                    class="block pl-8 pr-4 py-3 text-sm text-gray-600 hover:text-primary hover:bg-gray-50 transition-colors"
                    @click="closeMobileMenu"
                  >
                    Characters
                  </NuxtLink>
                  <NuxtLink
                    to="/assets/storyboards"
                    class="block pl-8 pr-4 py-3 text-sm text-gray-600 hover:text-primary hover:bg-gray-50 transition-colors"
                    @click="closeMobileMenu"
                  >
                    Storyboards
                  </NuxtLink>
                  <NuxtLink
                    to="/assets/music"
                    class="block pl-8 pr-4 py-3 text-sm text-gray-600 hover:text-primary hover:bg-gray-50 transition-colors"
                    @click="closeMobileMenu"
                  >
                    My Music
                  </NuxtLink>
                </div>
                <div class="rounded-lg border border-gray-200 overflow-hidden">
                  <NuxtLink
                    to="/tools"
                    class="block px-4 py-3.5 text-gray-900 font-medium bg-gray-50 border-b border-gray-200"
                    @click="closeMobileMenu"
                  >
                    Tools
                  </NuxtLink>
                  <NuxtLink
                    to="/tools/script-wizard"
                    class="block pl-8 pr-4 py-3 text-sm text-gray-600 hover:text-primary hover:bg-gray-50 transition-colors"
                    @click="closeMobileMenu"
                  >
                    Script Wizard
                  </NuxtLink>
                  <NuxtLink
                    to="/tools/storyboard-builder"
                    class="block pl-8 pr-4 py-3 text-sm text-gray-600 hover:text-primary hover:bg-gray-50 transition-colors"
                    @click="closeMobileMenu"
                  >
                    Storyboard Builder
                  </NuxtLink>
                </div>
                <div class="pt-2 border-t border-gray-200 mt-2 space-y-1">
                  <p v-if="userFirstName" class="px-4 py-1 text-xs font-medium uppercase tracking-wide text-gray-400">
                    {{ userFirstName }}
                  </p>
                  <NuxtLink
                    to="/account"
                    class="block px-4 py-3.5 text-gray-700 hover:text-primary hover:bg-gray-50 transition-colors rounded-lg font-medium"
                    @click="closeMobileMenu"
                  >
                    Settings
                  </NuxtLink>
                  <button
                    type="button"
                    class="w-full text-left px-4 py-3.5 text-gray-700 hover:text-red-600 hover:bg-gray-50 transition-colors rounded-lg font-medium"
                    @click="handleMobileLogout"
                  >
                    Logout
                  </button>
                </div>
              </template>
              <template v-else>
                <NuxtLink
                  to="/#capabilities"
                  class="block px-4 py-3.5 text-gray-700 hover:text-primary hover:bg-gray-50 transition-colors rounded-lg font-medium"
                  @click="closeMobileMenu"
                >
                  Capabilities
                </NuxtLink>
                <NuxtLink
                  to="/#how-it-works"
                  class="block px-4 py-3.5 text-gray-700 hover:text-primary hover:bg-gray-50 transition-colors rounded-lg font-medium"
                  @click="closeMobileMenu"
                >
                  How it works
                </NuxtLink>
                <NuxtLink
                  to="/#compare"
                  class="block px-4 py-3.5 text-gray-700 hover:text-primary hover:bg-gray-50 transition-colors rounded-lg font-medium"
                  @click="closeMobileMenu"
                >
                  Compare AI
                </NuxtLink>
                <NuxtLink
                  to="/#workflow"
                  class="block px-4 py-3.5 text-gray-700 hover:text-primary hover:bg-gray-50 transition-colors rounded-lg font-medium"
                  @click="closeMobileMenu"
                >
                  Workflow
                </NuxtLink>
                <div class="pt-2 border-t border-gray-200 mt-2">
                  <NuxtLink
                    to="/login"
                    class="block px-4 py-3.5 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg transition-colors text-center"
                    @click="closeMobileMenu"
                  >
                    Login
                  </NuxtLink>
                </div>
              </template>
              <template #fallback>
                <NuxtLink
                  to="/#capabilities"
                  class="block px-4 py-3.5 text-gray-700 hover:text-primary hover:bg-gray-50 transition-colors rounded-lg font-medium"
                  @click="closeMobileMenu"
                >
                  Capabilities
                </NuxtLink>
                <NuxtLink
                  to="/#how-it-works"
                  class="block px-4 py-3.5 text-gray-700 hover:text-primary hover:bg-gray-50 transition-colors rounded-lg font-medium"
                  @click="closeMobileMenu"
                >
                  How it works
                </NuxtLink>
                <NuxtLink
                  to="/#compare"
                  class="block px-4 py-3.5 text-gray-700 hover:text-primary hover:bg-gray-50 transition-colors rounded-lg font-medium"
                  @click="closeMobileMenu"
                >
                  Compare AI
                </NuxtLink>
                <NuxtLink
                  to="/#workflow"
                  class="block px-4 py-3.5 text-gray-700 hover:text-primary hover:bg-gray-50 transition-colors rounded-lg font-medium"
                  @click="closeMobileMenu"
                >
                  Workflow
                </NuxtLink>
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

const { showAuthenticatedUi, logout, user } = useAuth()

const dropdownOpen = ref(false)
const dropdownRef = ref(null)
const accountMenuRef = ref(null)
const generateDropdownOpen = ref(false)
const generateMenuRef = ref(null)
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

function closeAllDesktopDropdowns () {
  dropdownOpen.value = false
  generateDropdownOpen.value = false
  assetsDropdownOpen.value = false
  toolsDropdownOpen.value = false
}

const toggleDropdown = () => {
  const next = !dropdownOpen.value
  closeAllDesktopDropdowns()
  dropdownOpen.value = next
}

const closeDropdown = () => {
  dropdownOpen.value = false
}

const toggleGenerateDropdown = () => {
  const next = !generateDropdownOpen.value
  closeAllDesktopDropdowns()
  generateDropdownOpen.value = next
}

const closeGenerateDropdown = () => {
  generateDropdownOpen.value = false
}

const toggleAssetsDropdown = () => {
  const next = !assetsDropdownOpen.value
  closeAllDesktopDropdowns()
  assetsDropdownOpen.value = next
}

const closeAssetsDropdown = () => {
  assetsDropdownOpen.value = false
}

const toggleToolsDropdown = () => {
  const next = !toolsDropdownOpen.value
  closeAllDesktopDropdowns()
  toolsDropdownOpen.value = next
}

const closeToolsDropdown = () => {
  toolsDropdownOpen.value = false
}

const toggleMobileMenu = () => {
  mobileMenuOpen.value = !mobileMenuOpen.value
  closeAllDesktopDropdowns()
}

const closeMobileMenu = () => {
  mobileMenuOpen.value = false
}

const handleLogout = () => {
  closeDropdown()
  logout()
}

const handleMobileLogout = () => {
  closeMobileMenu()
  logout()
}

const handleClickOutside = (event) => {
  if (dropdownOpen.value && accountMenuRef.value && !accountMenuRef.value.contains(event.target)) {
    closeDropdown()
  }
  if (generateDropdownOpen.value && generateMenuRef.value && !generateMenuRef.value.contains(event.target)) {
    closeGenerateDropdown()
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
