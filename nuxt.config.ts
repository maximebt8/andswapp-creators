import tailwindcss from '@tailwindcss/vite'

// Espace créateurs &Swapp (creators.andswapp.com). Même socle que GTM-VIE : Nuxt 4, Tailwind 4, daisyUI,
// Nitro en cloudflare-pages, base D1 et bucket R2 à part. Rien de partagé avec la base des inscrits.
export default defineNuxtConfig({
  compatibilityDate: '2026-09-01',
  css: ['~/assets/main.css'],
  vite: { plugins: [tailwindcss()] },
  nitro: { preset: 'cloudflare-pages' },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: '&Swapp Creators',
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' }, { name: 'robots', content: 'noindex' }],
      link: [{ rel: 'icon', href: '/assets/keymark.svg' }],
    },
  },
})
