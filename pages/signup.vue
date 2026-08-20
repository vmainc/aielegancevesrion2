<template>
  <div class="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 bg-studio-charcoal">
    <div class="max-w-md w-full text-center">
      <NuxtLink to="/" class="inline-block mb-6">
        <img
          :src="logo"
          alt="AI Film Studio"
          class="h-16 w-auto mx-auto"
        />
      </NuxtLink>
      <div class="border border-primary/25 rounded-xl p-8 bg-studio-slate shadow-lg">
        <h1 class="font-display text-3xl text-ivory mb-2 tracking-wide">Invite only</h1>
        <p class="text-sm text-smoke leading-relaxed mb-6">
          AI Film Studio accounts are created by invitation. If you need access, ask your administrator to add you in PocketBase.
        </p>
        <NuxtLink
          to="/login"
          class="inline-flex items-center justify-center w-full px-4 py-3 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg transition-colors"
        >
          Sign in
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import logo from '~/assets/img/logo.png'

definePageMeta({
  layout: false
})
</script>
