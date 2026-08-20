<template>
  <div class="min-h-screen bg-studio-charcoal text-ivory antialiased">
    <NuxtLayout>
      <NuxtPage :key="$route.fullPath" />
    </NuxtLayout>
    <ToastContainer />
    <ClientOnly>
      <GuideCompanion />
    </ClientOnly>
  </div>
</template>

