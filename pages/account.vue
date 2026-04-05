<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
    <div class="mb-8 sm:mb-10">
      <h1 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">My Account</h1>
      <p class="text-sm sm:text-base text-gray-600">Manage your profile information and preferences</p>
    </div>

    <!-- Image Crop Modal -->
    <div
      v-if="showCropModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      @click.self="cancelCrop"
    >
      <div class="bg-white border border-gray-200 border border-gray-200 rounded-xl p-6 max-w-2xl w-full mx-4 shadow-2xl">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-bold text-gray-900">Crop Your Profile Picture</h2>
          <button
            @click="cancelCrop"
            class="text-gray-600 hover:text-gray-900 transition-colors"
            aria-label="Close"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="relative bg-white rounded-lg overflow-hidden mb-4" style="aspect-ratio: 1/1; max-height: 500px;">
          <!-- Crop Area Container -->
          <div
            ref="cropContainer"
            class="relative w-full h-full overflow-hidden cursor-move"
            @mousedown="startDrag"
            @touchstart="startDrag"
          >
            <!-- Draggable Image -->
            <img
              ref="cropImage"
              :src="cropImageSrc"
              alt="Crop preview"
              :style="imageStyle"
              class="absolute select-none pointer-events-none"
              draggable="false"
            />
            
            <!-- Crop Overlay (Circular) -->
            <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div class="relative w-64 h-64 rounded-full border-4 border-accent-cyan shadow-lg">
                <div class="absolute inset-0 rounded-full bg-black/50"></div>
                <!-- Crop indicator -->
                <div class="absolute inset-0 rounded-full border-2 border-white/30"></div>
              </div>
            </div>

            <!-- Grid overlay for alignment -->
            <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div class="w-64 h-64 rounded-full relative">
                <div class="absolute inset-0 flex items-center justify-center">
                  <div class="w-full h-px bg-white/10"></div>
                </div>
                <div class="absolute inset-0 flex items-center justify-center">
                  <div class="h-full w-px bg-white/10"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Zoom Controls -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Zoom: {{ Math.round(imageScale * 100) }}%
          </label>
          <input
            v-model.number="imageScale"
            type="range"
            min="0.5"
            max="3"
            step="0.05"
            class="w-full h-2 bg-white rounded-lg appearance-none cursor-pointer accent-accent-cyan"
          />
          <div class="flex justify-between text-xs text-gray-500 mt-1">
            <span>50%</span>
            <span>300%</span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex gap-3 justify-end">
          <button
            @click="cancelCrop"
            class="px-6 py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-white hover:border-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            @click="saveCrop"
            class="px-6 py-2.5 bg-accent-cyan hover:bg-accent-cyan/90 text-gray-950 font-semibold rounded-lg transition-colors"
          >
            Save Crop
          </button>
        </div>
      </div>
    </div>
    
    <div class="border border-gray-200 rounded-xl p-10 bg-white border border-gray-200 shadow-lg">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <!-- Left Section: Profile Picture -->
        <div class="lg:col-span-1">
          <div class="space-y-6">
            <div class="flex flex-col items-center">
              <div class="relative group">
                <div class="absolute inset-0 rounded-full bg-accent-cyan opacity-0 group-hover:opacity-20 blur-xl transition-opacity"></div>
                <img
                  v-if="profilePicture"
                  :src="profilePicture"
                  alt="Profile"
                  class="relative w-40 h-40 rounded-full object-cover border-4 border-accent-cyan shadow-lg"
                />
                <div
                  v-else
                  class="relative w-40 h-40 rounded-full bg-gradient-to-br from-gray-200 to-gray-100 border-4 border-accent-cyan flex items-center justify-center shadow-lg"
                >
                  <svg
                    class="w-20 h-20 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <button
                  @click="triggerFileInput"
                  class="absolute bottom-0 right-0 w-10 h-10 bg-accent-cyan rounded-full flex items-center justify-center text-gray-950 shadow-lg hover:bg-accent-cyan/90 transition-colors border-2 border-white"
                  aria-label="Change photo"
                >
                  <svg
                    class="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                </button>
              </div>
            </div>
            
            <div
              @click="triggerFileInput"
              @dragover.prevent
              @drop.prevent="handleDrop"
              class="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-accent-cyan hover:bg-gray-100 transition-all group"
            >
              <input
                ref="fileInput"
                type="file"
                accept="image/jpeg,image/png,image/gif"
                class="hidden"
                @change="handleFileSelect"
              />
              <div class="flex flex-col items-center">
                <div class="w-12 h-12 rounded-full bg-white flex items-center justify-center mb-4 group-hover:bg-accent-cyan/10 transition-colors">
                  <svg
                    class="w-6 h-6 text-gray-600 group-hover:text-accent-cyan transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                    />
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <p class="text-gray-700 font-medium mb-1">Drag & drop your photo here</p>
                <p class="text-sm text-gray-500 mb-3">or click to browse</p>
                <p class="text-xs text-gray-600">JPEG, PNG, GIF up to 5MB</p>
              </div>
            </div>
            
            <div class="pt-4 border-t border-gray-200">
              <div class="text-center">
                <p class="text-xs text-gray-500 uppercase tracking-wide mb-1">Current Email</p>
                <ClientOnly>
                  <p class="text-gray-700 font-medium">{{ userEmail }}</p>
                  <template #fallback>
                    <p class="text-gray-700 font-medium">Loading...</p>
                  </template>
                </ClientOnly>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Right Section: Profile Form -->
        <div class="lg:col-span-2">
          <div class="space-y-6">
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-3">
                First Name
              </label>
              <input
                v-model="formData.firstName"
                type="text"
                class="w-full px-4 py-3.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 focus:border-accent-cyan transition-all"
                placeholder="Enter your first name"
              />
            </div>
            
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-3">
                Last Name
              </label>
              <input
                v-model="formData.lastName"
                type="text"
                class="w-full px-4 py-3.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 focus:border-accent-cyan transition-all"
                placeholder="Enter your last name"
              />
            </div>
            
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-3">
                Email Address
              </label>
              <input
                v-model="formData.email"
                type="email"
                class="w-full px-4 py-3.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 focus:border-accent-cyan transition-all"
                placeholder="Enter your email"
              />
            </div>
          </div>
        </div>
      </div>
      
      <!-- Change Password Section -->
      <div class="mt-10 pt-8 border-t border-gray-200">
        <div class="mb-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-2">Change Password</h2>
          <p class="text-sm text-gray-600">Update your password to keep your account secure</p>
        </div>
        
        <form @submit.prevent="handleChangePassword" class="space-y-4">
          <div>
            <label for="currentPassword" class="block text-sm font-semibold text-gray-700 mb-2">
              Current Password
            </label>
            <input
              id="currentPassword"
              v-model="passwordData.currentPassword"
              type="password"
              autocomplete="current-password"
              class="w-full px-4 py-3.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 focus:border-accent-cyan transition-all"
              placeholder="Enter your current password"
            />
          </div>
          
          <div>
            <label for="newPassword" class="block text-sm font-semibold text-gray-700 mb-2">
              New Password
            </label>
            <input
              id="newPassword"
              v-model="passwordData.newPassword"
              type="password"
              autocomplete="new-password"
              class="w-full px-4 py-3.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 focus:border-accent-cyan transition-all"
              placeholder="Enter your new password"
            />
            <p class="mt-1 text-xs text-gray-500">Must be at least 8 characters</p>
          </div>
          
          <div>
            <label for="confirmPassword" class="block text-sm font-semibold text-gray-700 mb-2">
              Confirm New Password
            </label>
            <input
              id="confirmPassword"
              v-model="passwordData.confirmPassword"
              type="password"
              autocomplete="new-password"
              class="w-full px-4 py-3.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 focus:border-accent-cyan transition-all"
              placeholder="Confirm your new password"
            />
          </div>
          
          <div class="flex justify-end">
            <button
              type="submit"
              :disabled="passwordLoading || !isPasswordFormValid"
              class="px-6 py-3 bg-accent-cyan hover:bg-accent-cyan/90 text-gray-950 font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span v-if="!passwordLoading">Change Password</span>
              <span v-else class="flex items-center justify-center gap-2">
                <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Changing...
              </span>
            </button>
          </div>
        </form>
      </div>
      
      <!-- Update Profile Button -->
      <div class="mt-10 pt-8 border-t border-gray-200">
        <div class="flex items-center justify-between">
          <div class="text-sm text-gray-500">
            Make sure your information is up to date
          </div>
          <button
            @click="updateProfile"
            :disabled="loading"
            class="px-8 py-3.5 bg-accent-cyan hover:bg-accent-cyan/90 text-gray-950 font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-accent-cyan/20 min-w-[160px]"
          >
            <span v-if="!loading">Update Profile</span>
            <span v-else class="flex items-center justify-center gap-2">
              <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Updating...
            </span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
})

const { user, changePassword } = useAuth()
const { error: showError, success: showSuccess, warning: showWarning } = useToast()
const fileInput = ref(null)
const profilePicture = ref(null)
const originalProfilePicture = ref(null) // Store original URL to detect changes
const loading = ref(false)
const passwordLoading = ref(false)

// Crop modal state
const showCropModal = ref(false)
const cropImageSrc = ref('')
const cropImage = ref(null)
const cropContainer = ref(null)

// Image positioning state
const imagePosition = ref({ x: 0, y: 0 })
const imageScale = ref(1)
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const imageStartPos = ref({ x: 0, y: 0 })

const formData = ref({
  firstName: '',
  lastName: '',
  email: ''
})

const passwordData = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const isPasswordFormValid = computed(() => {
  return (
    passwordData.value.currentPassword &&
    passwordData.value.newPassword &&
    passwordData.value.confirmPassword &&
    passwordData.value.newPassword === passwordData.value.confirmPassword &&
    passwordData.value.newPassword.length >= 8
  )
})

const userEmail = computed(() => user.value?.email || '')

// Computed style for the draggable image
const imageStyle = computed(() => {
  const scale = imageScale.value
  return {
    transform: `translate(${imagePosition.value.x}px, ${imagePosition.value.y}px) scale(${scale})`,
    transformOrigin: 'top left',
    transition: isDragging.value ? 'none' : 'transform 0.1s ease-out'
  }
})

const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleFileSelect = (event) => {
  const file = event.target.files?.[0]
  if (file) {
    validateAndSetImage(file)
  }
}

const handleDrop = (event) => {
  const file = event.dataTransfer.files?.[0]
  if (file) {
    validateAndSetImage(file)
  }
}

const validateAndSetImage = (file) => {
  const maxSize = 5 * 1024 * 1024 // 5MB
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif']
  
  if (!allowedTypes.includes(file.type)) {
    showError('Please select a JPEG, PNG, or GIF image')
    return
  }
  
  if (file.size > maxSize) {
    showError('File size must be less than 5MB')
    return
  }
  
  const reader = new FileReader()
  reader.onload = (e) => {
    cropImageSrc.value = e.target.result
    showCropModal.value = true
    // Reset crop state
    imagePosition.value = { x: 0, y: 0 }
    imageScale.value = 1
    
    // Center the image after it loads
    nextTick(() => {
      centerImage()
    })
  }
  reader.readAsDataURL(file)
}

const centerImage = () => {
  if (!cropImage.value || !cropContainer.value) return
  
  nextTick(() => {
    const container = cropContainer.value
    const img = cropImage.value
    const cropSize = 256 // 64 * 4 (w-64 = 256px)
    
    // Get natural image dimensions
    const imgNaturalWidth = img.naturalWidth
    const imgNaturalHeight = img.naturalHeight
    
    // Calculate scale to fit image within crop area
    const scaleToFit = Math.max(cropSize / imgNaturalWidth, cropSize / imgNaturalHeight) * 1.2
    imageScale.value = Math.max(scaleToFit, 0.5)
    
    // Center the image
    const scaledWidth = imgNaturalWidth * imageScale.value
    const scaledHeight = imgNaturalHeight * imageScale.value
    
    imagePosition.value = {
      x: (container.clientWidth - scaledWidth) / 2,
      y: (container.clientHeight - scaledHeight) / 2
    }
  })
}

const startDrag = (e) => {
  isDragging.value = true
  const clientX = e.touches ? e.touches[0].clientX : e.clientX
  const clientY = e.touches ? e.touches[0].clientY : e.clientY
  
  dragStart.value = { x: clientX, y: clientY }
  imageStartPos.value = { ...imagePosition.value }
  
  e.preventDefault()
}

const handleDrag = (e) => {
  if (!isDragging.value) return
  
  const clientX = e.touches ? e.touches[0].clientX : e.clientX
  const clientY = e.touches ? e.touches[0].clientY : e.clientY
  
  const deltaX = clientX - dragStart.value.x
  const deltaY = clientY - dragStart.value.y
  
  imagePosition.value = {
    x: imageStartPos.value.x + deltaX,
    y: imageStartPos.value.y + deltaY
  }
}

const stopDrag = () => {
  isDragging.value = false
}

const cancelCrop = () => {
  showCropModal.value = false
  cropImageSrc.value = ''
  imagePosition.value = { x: 0, y: 0 }
  imageScale.value = 1
  fileInput.value.value = '' // Reset file input
}

const saveCrop = () => {
  if (!cropImage.value || !cropContainer.value) return
  
  // Wait for image to be fully loaded
  if (!cropImage.value.complete || cropImage.value.naturalWidth === 0) {
    cropImage.value.onload = saveCrop
    return
  }
  
  const canvas = document.createElement('canvas')
  const size = 256 // Final cropped size (matches w-64)
  canvas.width = size
  canvas.height = size
  
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  
  const img = cropImage.value
  const container = cropContainer.value
  const cropSize = 256 // Crop area size (w-64 = 256px)
  
  // Get actual rendered positions
  const imgRect = img.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  
  // Get image natural dimensions
  const imgNaturalWidth = img.naturalWidth
  const imgNaturalHeight = img.naturalHeight
  
  // Calculate actual displayed dimensions
  const displayedWidth = imgRect.width
  const displayedHeight = imgRect.height
  
  // Calculate scale from displayed to natural
  const scaleX = displayedWidth / imgNaturalWidth
  const scaleY = displayedHeight / imgNaturalHeight
  
  // Container center in screen coordinates
  const containerCenterScreenX = containerRect.left + containerRect.width / 2
  const containerCenterScreenY = containerRect.top + containerRect.height / 2
  
  // Image top-left in screen coordinates
  const imgTopLeftScreenX = imgRect.left
  const imgTopLeftScreenY = imgRect.top
  
  // Offset from image top-left to crop center (in screen/pixel coordinates)
  const offsetScreenX = containerCenterScreenX - imgTopLeftScreenX
  const offsetScreenY = containerCenterScreenY - imgTopLeftScreenY
  
  // Convert screen offset to natural image coordinates
  const offsetNaturalX = offsetScreenX / scaleX
  const offsetNaturalY = offsetScreenY / scaleY
  
  // Crop size in natural coordinates
  const cropSizeNatural = cropSize / scaleX
  
  // Calculate top-left of crop area in natural image coordinates
  const sourceX = offsetNaturalX - (cropSizeNatural / 2)
  const sourceY = offsetNaturalY - (cropSizeNatural / 2)
  
  // Clamp to image bounds
  const clampedSourceX = Math.max(0, Math.min(sourceX, imgNaturalWidth))
  const clampedSourceY = Math.max(0, Math.min(sourceY, imgNaturalHeight))
  const clampedCropWidth = Math.min(cropSizeNatural, imgNaturalWidth - clampedSourceX)
  const clampedCropHeight = Math.min(cropSizeNatural, imgNaturalHeight - clampedSourceY)
  
  // Use the smaller dimension to maintain square aspect ratio
  const finalCropSize = Math.min(clampedCropWidth, clampedCropHeight)
  
  // Draw the cropped image with circular clipping
  ctx.save()
  
  // Create circular clipping path
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  ctx.clip()
  
  // Clear with transparent
  ctx.clearRect(0, 0, size, size)
  
  // Draw the cropped portion of the image
  ctx.drawImage(
    img,
    clampedSourceX,
    clampedSourceY,
    finalCropSize,
    finalCropSize,
    0,
    0,
    size,
    size
  )
  
  ctx.restore()
  
  // Convert to blob and update profile picture
  canvas.toBlob((blob) => {
    if (blob) {
      const reader = new FileReader()
      reader.onload = (e) => {
        profilePicture.value = e.target.result
        showCropModal.value = false
        cropImageSrc.value = ''
        imagePosition.value = { x: 0, y: 0 }
        imageScale.value = 1
      }
      reader.readAsDataURL(blob)
    }
  }, 'image/png')
}

// Add global mouse/touch event listeners for dragging
onMounted(() => {
  // Load user data from auth
  if (user.value) {
    formData.value.email = user.value.email || ''
    formData.value.firstName = user.value.name?.split(' ')[0] || ''
    formData.value.lastName = user.value.name?.split(' ').slice(1).join(' ') || ''
    
    // Load profile picture if available
    if (user.value.avatar) {
      const pb = useAuth().getPocketBase()
      const avatarUrl = pb.files.getURL(user.value, user.value.avatar)
      profilePicture.value = avatarUrl
      originalProfilePicture.value = avatarUrl
    }
  }
  
  // Add global drag listeners
  document.addEventListener('mousemove', handleDrag)
  document.addEventListener('mouseup', stopDrag)
  document.addEventListener('touchmove', handleDrag)
  document.addEventListener('touchend', stopDrag)
})

onUnmounted(() => {
  // Clean up global listeners
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.removeEventListener('touchmove', handleDrag)
  document.removeEventListener('touchend', stopDrag)
})

const updateProfile = async () => {
  if (!user.value) {
    showError('You must be logged in to update your profile')
    return
  }

  loading.value = true
  try {
    const pb = useAuth().getPocketBase()
    const updateData: any = {
      email: formData.value.email,
      name: `${formData.value.firstName} ${formData.value.lastName}`.trim() || formData.value.firstName
    }

    // Check if profile picture has changed (new crop or upload)
    const hasNewPicture = profilePicture.value && 
      profilePicture.value !== originalProfilePicture.value &&
      profilePicture.value.startsWith('data:image')
    
    // If there's a new profile picture (base64 data URL), convert and upload it
    if (hasNewPicture) {
      // Convert base64 to File
      const base64Data = profilePicture.value.split(',')[1]
      const byteCharacters = atob(base64Data)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: 'image/png' })
      const file = new File([blob], 'avatar.png', { type: 'image/png' })
      
      // Create FormData for file upload
      const uploadFormData = new FormData()
      uploadFormData.append('avatar', file)
      uploadFormData.append('email', updateData.email)
      uploadFormData.append('name', updateData.name)
      
      // Update user record with avatar
      await pb.collection('users').update(user.value.id, uploadFormData)
    } else {
      // Update without avatar
      await pb.collection('users').update(user.value.id, updateData)
    }

    // Refresh auth to get updated user data
    await pb.collection('users').authRefresh()
    
    // Reload profile picture URL if avatar exists
    const updatedUser = pb.authStore.model
    if (updatedUser?.avatar) {
      const newAvatarUrl = pb.files.getURL(updatedUser, updatedUser.avatar)
      profilePicture.value = newAvatarUrl
      originalProfilePicture.value = newAvatarUrl
    }

    showSuccess('Profile updated successfully!')
  } catch (error: any) {
    console.error('Error updating profile:', error)
    showError(error.response?.message || error.message || 'Failed to update profile')
  } finally {
    loading.value = false
  }
}

const handleChangePassword = async () => {
  if (!isPasswordFormValid.value) {
    showError('Please fill in all fields and ensure passwords match')
    return
  }

  passwordLoading.value = true
  try {
    const result = await changePassword(
      passwordData.value.currentPassword,
      passwordData.value.newPassword,
      passwordData.value.confirmPassword
    )

    if (result.success) {
      showSuccess('Password changed successfully!')
      // Clear password fields
      passwordData.value = {
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }
    } else {
      showError(result.error || 'Failed to change password')
    }
  } catch (error: any) {
    showError(error.message || 'An unexpected error occurred')
  } finally {
    passwordLoading.value = false
  }
}

</script>

