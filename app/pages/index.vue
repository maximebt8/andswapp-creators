<script setup>
// La porte d'entrée : l'espace est sur invitation, chacune a son lien. Ici, seulement « j'ai perdu mon lien ».
useHead({ title: '&Swapp Creators' })
const email = ref('')
const state = ref('idle') // idle | sending | done | error
const send = async () => {
  if (state.value === 'sending') return
  state.value = 'sending'
  try {
    await $fetch('/api/lost-link', { method: 'POST', body: { email: email.value.trim() } })
    state.value = 'done'
  } catch {
    state.value = 'error'
  }
}
</script>

<template>
  <div class="min-h-dvh bg-base-200">
    <div class="mx-auto flex min-h-dvh w-full max-w-xl flex-col bg-white md:border-x md:border-gray-200">
      <SwappHeader subtitle="Creators" />
      <main class="flex flex-1 flex-col justify-center px-6 pb-16">
        <img src="/assets/keymark.svg" alt="" class="key-breathe mb-6 h-14 w-14" />
        <h1 class="text-3xl font-extrabold leading-tight text-green-dark">Your creator space with &Swapp</h1>
        <p class="mt-3 text-[15px] text-gray-600">Your offer, your brief, your draft, your stats and your payment. All in one place, with your personal link.</p>
        <p class="mt-2 text-[15px] text-gray-600">This space is by invitation. If Max sent you a link, open it from that email.</p>

        <div class="card-soft mt-8">
          <p class="label-soft">Lost your link?</p>
          <template v-if="state !== 'done'">
            <p class="mt-1 text-[14px] text-gray-600">Type the email you used with us. We will send your link again.</p>
            <form class="mt-3 flex flex-col gap-2 sm:flex-row" @submit.prevent="send">
              <input v-model="email" type="email" required placeholder="you@example.com" class="input-soft" />
              <button type="submit" class="btn-swapp px-5 py-2.5 text-[14px]" :disabled="state === 'sending'">Send my link</button>
            </form>
            <p v-if="state === 'error'" class="mt-2 text-[13px] text-error">Something went wrong. Try again, or write to hello@andswapp.com.</p>
          </template>
          <p v-else class="mt-1 text-[14px] text-green-dark">Done. If this email is in our list, your link is on its way.</p>
        </div>

        <p class="mt-10 text-[13px] text-gray-400">&Swapp · <a href="https://andswapp.com" class="underline">andswapp.com</a></p>
      </main>
    </div>
  </div>
</template>
