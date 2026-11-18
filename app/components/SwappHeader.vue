<script setup>
defineProps({ subtitle: { type: String, default: '' }, to: { type: String, default: '/' } })
</script>

<template>
  <header class="flex items-center gap-3 px-5 py-4 md:px-8">
    <NuxtLink :to="to" class="flex items-center gap-2">
      <img src="/assets/keymark.svg" alt="" class="h-7 w-7" />
      <span class="text-lg font-extrabold text-green-dark md:text-xl">&Swapp</span>
    </NuxtLink>
    <span v-if="subtitle" class="rounded-full bg-green-light/40 px-2.5 py-0.5 text-[12px] font-semibold text-green-dark">{{ subtitle }}</span>
    <slot />
  </header>
</template>
