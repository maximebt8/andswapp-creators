<script setup>
// La coque de l'espace créatrice, sur le modèle du portail partenaire d'Impact : menu à gauche (en bas sur mobile),
// barre de titre en haut, contenu sur fond gris clair en cartes blanches.
const props = defineProps({ nav: { type: Array, required: true }, current: { type: String, required: true }, title: { type: String, required: true }, name: { type: String, default: '' }, base: { type: String, required: true } })
const initials = computed(() => props.name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase())
</script>

<template>
  <div class="min-h-dvh bg-[#f3f4f6] md:flex">
    <!-- Menu de gauche (desktop) -->
    <aside class="hidden w-60 shrink-0 flex-col bg-green-dark text-white md:flex md:min-h-dvh">
      <NuxtLink :to="base" class="flex items-center gap-2.5 px-5 py-5">
        <img src="/assets/keymark.svg" alt="" class="h-7 w-7" />
        <span class="text-lg font-extrabold">&Swapp</span>
        <span class="ml-auto rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">Creators</span>
      </NuxtLink>
      <nav class="mt-2 flex flex-col gap-0.5 px-3">
        <NuxtLink v-for="item in nav" :key="item.key" :to="item.to" class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium transition-colors" :class="current === item.key ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'">
          <span class="flex h-5 w-5 items-center justify-center" v-html="item.icon"></span>
          <span>{{ item.label }}</span>
          <span v-if="item.badge" class="ml-auto rounded-full bg-yellow px-1.5 py-0.5 text-[11px] font-bold text-green-dark">{{ item.badge }}</span>
        </NuxtLink>
      </nav>
      <div class="mt-auto px-5 py-5 text-[12px] text-white/50">
        <p>Questions? <a href="mailto:maxime.barret@andswapp.com" class="text-white/80 underline">Email Max</a></p>
        <p class="mt-1">&Swapp Creator Programme</p>
      </div>
    </aside>

    <div class="flex min-h-dvh flex-1 flex-col">
      <!-- Barre du haut -->
      <header class="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 md:px-8">
        <img src="/assets/keymark.svg" alt="" class="h-6 w-6 md:hidden" />
        <h1 class="text-[17px] font-bold text-gray-900 md:text-xl">{{ title }}</h1>
        <div class="ml-auto flex items-center gap-3">
          <slot name="actions" />
          <NuxtLink v-if="name" :to="`${base}/profile`" class="flex items-center gap-2">
            <span class="hidden text-[13px] text-gray-600 md:inline">{{ name }}</span>
            <span class="flex h-8 w-8 items-center justify-center rounded-full bg-green-light/60 text-[12px] font-bold text-green-dark">{{ initials }}</span>
          </NuxtLink>
        </div>
      </header>

      <main class="flex-1 px-4 pb-24 pt-5 md:px-8 md:pb-10">
        <div class="mx-auto w-full max-w-5xl">
          <slot />
        </div>
      </main>

      <!-- Onglets du bas (mobile) -->
      <nav class="fixed inset-x-0 bottom-0 z-20 flex border-t border-gray-200 bg-white md:hidden">
        <NuxtLink v-for="item in nav" :key="item.key" :to="item.to" class="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold" :class="current === item.key ? 'text-green-dark' : 'text-gray-400'">
          <span class="relative flex h-5 w-5 items-center justify-center" v-html="item.icon"></span>
          <span>{{ item.label }}</span>
        </NuxtLink>
      </nav>
    </div>
  </div>
</template>
