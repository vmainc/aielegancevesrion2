<template>
  <div class="min-h-screen bg-white text-gray-900 antialiased">
    <NuxtLayout>
      <NuxtPage :key="$route.fullPath" />
    </NuxtLayout>
    <ToastContainer />
  </div>
</template>

