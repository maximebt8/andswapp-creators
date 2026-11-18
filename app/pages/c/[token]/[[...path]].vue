<script setup>
// L'espace d'une créatrice, sur le modèle du portail partenaire d'Impact (max, 18/11) : un menu à gauche, une page par
// sujet. Dashboard (ce qui l'attend, ses chiffres), Campaigns (l'offre, les termes, le brief, le suivi), Content (ses
// livrables), Tracking (son lien, ses inscrits), Payments (ce qu'on lui doit, sa facture, son RIB), Profile.
// Les échanges restent par mail. Tout ce qu'elle fait est daté et visible : le programme doit paraître très cadré.
import { money } from '~~/shared/utils/collab'
import { ICONS } from '~/utils/icons'

const route = useRoute()
const token = computed(() => String(route.params.token ?? ''))
const base = computed(() => `/c/${token.value}`)
const path = computed(() => (Array.isArray(route.params.path) ? route.params.path : route.params.path ? [route.params.path] : []))
const section = computed(() => path.value[0] || 'home')
const detailId = computed(() => (section.value === 'campaigns' && path.value[1] ? Number(path.value[1]) : null))

const TITLES = { home: 'Dashboard', campaigns: 'Campaigns', content: 'Content', tracking: 'Tracking', payments: 'Payments', profile: 'Profile' }
useHead({ title: computed(() => `${TITLES[section.value] ?? 'My space'} · &Swapp Creators`) })

const { data, error, refresh } = await useFetch('/api/me', { query: { t: token }, key: 'me' })
const me = computed(() => data.value?.me)
const collabs = computed(() => data.value?.collabs ?? [])
const first = computed(() => (me.value?.name ?? '').split(' ')[0])
const detail = computed(() => collabs.value.find((c) => c.id === detailId.value))

const busy = ref('')
const errors = reactive({})
const forms = reactive({})
const form = (id) => (forms[id] ??= { note: '', url: '', post: '', file: null, progress: 0 })

const call = async (key, fn) => {
  if (busy.value) return
  busy.value = key
  errors[key] = ''
  try {
    await fn()
    await refresh()
  } catch (e) {
    errors[key] = e?.data?.statusMessage || e?.statusMessage || e?.message || 'Something went wrong. Try again.'
  } finally {
    busy.value = ''
  }
}

const accept = (c, yes) => call(`accept-${c.id}`, () => $fetch('/api/accept', { method: 'POST', body: { t: token.value, collab: c.id, accept: yes } }))

// Le fichier part en une fois, en brut, vers /api/upload ; XMLHttpRequest pour la progression.
const upload = (c, file, kind) =>
  new Promise((resolve, reject) => {
    const f = form(c.id)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `/api/upload?${new URLSearchParams({ t: token.value, collab: c.id, kind, name: file.name })}`)
    xhr.setRequestHeader('content-type', file.type || 'application/octet-stream')
    xhr.upload.onprogress = (e) => (f.progress = e.lengthComputable ? Math.round((e.loaded / e.total) * 100) : 50)
    xhr.onload = () => (xhr.status < 300 ? resolve(JSON.parse(xhr.responseText)) : reject(new Error(xhr.status === 413 ? 'File too big (200 MB max).' : 'Upload failed.')))
    xhr.onerror = () => reject(new Error('Upload failed.'))
    xhr.send(file)
  })

const sendDraft = (c) =>
  call(`draft-${c.id}`, async () => {
    const f = form(c.id)
    if (f.file) await upload(c, f.file, 'draft')
    else if (!f.url && !c.draft_key) throw new Error('Add a file or a link first.')
    await $fetch('/api/deliver', { method: 'POST', body: { t: token.value, collab: c.id, step: 'draft', url: f.url, note: f.note } })
    f.file = null
    f.progress = 0
  })
const sendPost = (c) => call(`post-${c.id}`, () => $fetch('/api/deliver', { method: 'POST', body: { t: token.value, collab: c.id, step: 'published', url: form(c.id).post } }))
const sendInvoice = (c, file) => call(`invoice-${c.id}`, () => upload(c, file, 'invoice'))

const pay = reactive({ payout_name: '', payout_details: '', invoice_mode: 'self', open: false })
const savePayout = () =>
  call('payout', async () => {
    await $fetch('/api/payout', { method: 'POST', body: { t: token.value, ...pay } })
    pay.open = false
  })

const copied = ref('')
const copy = async (what, value) => {
  try {
    await navigator.clipboard.writeText(value)
    copied.value = what
    setTimeout(() => (copied.value = ''), 1500)
  } catch {}
}

const day = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '')
const short = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '')

// Le programme en 6 étapes, toujours visible : où elle en est, ce qui est fait, ce qui vient.
const STEPS = ['Offer', 'Brief', 'Draft', 'Review', 'Live', 'Payment']
const STEP_OF = { offered: 0, declined: 0, accepted: 1, draft_submitted: 3, changes_requested: 2, approved: 4, published: 5, invoiced: 5, paid: 6 }
const stepIndex = (c) => STEP_OF[c.status] ?? 0
const NEXT = {
  offered: 'Review the terms and accept the offer to unlock your brief.',
  accepted: 'Read the brief, shoot, then submit your draft in Content.',
  draft_submitted: 'Max reviews your draft within 48 hours.',
  changes_requested: 'Submit the new version in Content when ready.',
  approved: 'Post it, then paste the link in Content so we can track it.',
  published: 'Sign-ups are tracked for 30 days. Send your invoice from Payments when you are ready.',
  invoiced: 'Transfer in progress, usually within 5 working days.',
  paid: 'All done. Thank you.',
  declined: 'You declined this offer.',
}
// La tâche du moment, par collab, pour la liste « Your tasks » du tableau de bord.
const TASK = {
  offered: { label: 'Review and accept your offer', to: (c) => `campaigns/${c.id}` },
  accepted: { label: 'Submit your draft', to: () => 'content' },
  changes_requested: { label: 'Submit a new version', to: () => 'content' },
  approved: { label: 'Post and share the link', to: () => 'content' },
  published: { label: 'Send your invoice', to: () => 'payments' },
}
const tasks = computed(() => collabs.value.filter((c) => TASK[c.status]).map((c) => ({ c, ...TASK[c.status], to: `${base.value}/${TASK[c.status].to(c)}` })))
const waiting = computed(() => collabs.value.filter((c) => c.status === 'draft_submitted' || c.status === 'invoiced'))

// L'historique daté : ce qui s'est passé, du plus ancien au plus récent.
const timeline = (c) =>
  [
    [c.offered_at, 'Offer sent by &Swapp'],
    [c.accepted_at, 'Terms accepted'],
    [c.draft_at, 'Draft submitted'],
    [c.approved_at, 'Draft approved'],
    [c.published_at, 'Content live'],
    [c.invoice_at, 'Invoice received'],
    [c.paid_at, 'Payment sent'],
  ].filter(([at]) => at)
const canDraft = (c) => ['accepted', 'changes_requested', 'draft_submitted'].includes(c.status)
const live = (c) => ['published', 'invoiced', 'paid'].includes(c.status)
const active = computed(() => collabs.value.filter((c) => !['paid', 'declined'].includes(c.status)))
const DELIVERABLE_STATE = {
  offered: 'Locked until you accept', accepted: 'To submit', changes_requested: 'New version needed', draft_submitted: 'In review', approved: 'Approved, ready to post', published: 'Live', invoiced: 'Live', paid: 'Live', declined: 'Declined',
}

// Les chiffres du tableau de bord et de la page Payments.
const sum = (list, f) => list.reduce((s, c) => s + f(c), 0)
const totals = computed(() => {
  const list = collabs.value.filter((c) => c.status !== 'declined')
  const paid = sum(list.filter((c) => c.status === 'paid'), (c) => c.paid_amount ?? c.money.total)
  const pending = sum(list.filter((c) => live(c) && c.status !== 'paid'), (c) => c.money.total)
  const upcoming = sum(list.filter((c) => !live(c) && c.status !== 'offered'), (c) => c.money.fixed + c.money.boost)
  return { paid, pending, upcoming, signups: sum(list, (c) => c.signups), waitlist: sum(list, (c) => c.waitlist), currency: list[0]?.currency ?? 'GBP' }
})
const personalLink = computed(() => (me.value?.code ? `https://alumni.andswapp.com/en?utm_source=${encodeURIComponent(me.value.code)}&utm_medium=influence&utm_campaign=createurs_londres` : ''))

const nav = computed(() => [
  { key: 'home', label: 'Dashboard', to: base.value, icon: ICONS.home },
  { key: 'campaigns', label: 'Campaigns', to: `${base.value}/campaigns`, icon: ICONS.campaigns, badge: collabs.value.filter((c) => c.status === 'offered').length || '' },
  { key: 'content', label: 'Content', to: `${base.value}/content`, icon: ICONS.content, badge: collabs.value.filter((c) => ['accepted', 'changes_requested', 'approved'].includes(c.status)).length || '' },
  { key: 'tracking', label: 'Tracking', to: `${base.value}/tracking`, icon: ICONS.tracking },
  { key: 'payments', label: 'Payments', to: `${base.value}/payments`, icon: ICONS.payments, badge: collabs.value.filter((c) => c.status === 'published').length || '' },
  { key: 'profile', label: 'Profile', to: `${base.value}/profile`, icon: ICONS.profile },
])
const title = computed(() => (detail.value ? detail.value.title : TITLES[section.value] ?? 'My space'))
</script>

<template>
  <div v-if="error || !me" class="flex min-h-dvh flex-col items-center justify-center bg-[#f3f4f6] px-6 text-center">
    <img src="/assets/keymark.svg" alt="" class="h-10 w-10" />
    <h1 class="mt-4 text-2xl font-extrabold text-green-dark">This link does not work</h1>
    <p class="mt-2 max-w-sm text-[15px] text-gray-600">Open the link from the email Max sent you, or <NuxtLink to="/" class="underline">ask for it again</NuxtLink>.</p>
  </div>

  <CreatorShell v-else :nav="nav" :current="section" :title="title" :name="me.name" :handle="me.handle || ''" :base="base">
    <!-- ===== Dashboard ===== -->
    <template v-if="section === 'home'">
      <h2 class="text-xl font-extrabold text-gray-900">Welcome back, {{ me.name }}</h2>
      <p class="mt-0.5 text-[15px] text-gray-600">Here is where your &Swapp partnership stands.</p>

      <div class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div class="swapp-card p-4"><p class="label-soft">Active campaigns</p><p class="mt-1 text-2xl font-extrabold text-gray-900">{{ active.length }}</p></div>
        <div class="swapp-card p-4"><p class="label-soft">Sign-ups tracked</p><p class="mt-1 text-2xl font-extrabold text-gray-900">{{ totals.signups }}</p><p v-if="totals.waitlist" class="text-[12px] text-gray-500">+ {{ totals.waitlist }} waitlist</p></div>
        <div class="swapp-card p-4"><p class="label-soft">Pending payout</p><p class="mt-1 text-2xl font-extrabold text-gray-900">{{ money(totals.pending, totals.currency) }}</p></div>
        <div class="swapp-card p-4"><p class="label-soft">Paid to date</p><p class="mt-1 text-2xl font-extrabold text-green-dark">{{ money(totals.paid, totals.currency) }}</p></div>
      </div>

      <div class="mt-5 grid gap-4 md:grid-cols-5">
        <section class="swapp-card md:col-span-3">
          <div class="flex items-center justify-between border-b border-gray-100 px-5 py-3.5"><h2 class="text-[15px] font-bold text-gray-900">Your tasks</h2><span class="pill bg-yellow/30 text-green-dark">{{ tasks.length }} to do</span></div>
          <ul v-if="tasks.length" class="divide-y divide-gray-100">
            <li v-for="t in tasks" :key="t.c.id">
              <NuxtLink :to="t.to" class="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50">
                <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow/30 text-green-dark" v-html="ICONS.clock"></span>
                <span class="min-w-0 flex-1"><span class="block text-[14px] font-semibold text-gray-900">{{ t.label }}</span><span class="block truncate text-[12px] text-gray-500">{{ t.c.title }}</span></span>
                <span class="text-gray-400" v-html="ICONS.arrow"></span>
              </NuxtLink>
            </li>
          </ul>
          <ul v-if="waiting.length" class="divide-y divide-gray-100 border-t border-gray-100">
            <li v-for="c in waiting" :key="c.id" class="flex items-center gap-3 px-5 py-3.5">
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-light/40 text-green-dark" v-html="ICONS.check"></span>
              <span class="min-w-0 flex-1"><span class="block text-[14px] font-semibold text-gray-900">{{ c.status === 'invoiced' ? 'Transfer in progress' : 'Draft in review' }}</span><span class="block truncate text-[12px] text-gray-500">{{ c.title }} · nothing to do on your side</span></span>
            </li>
          </ul>
          <p v-if="!tasks.length && !waiting.length" class="px-5 py-6 text-[14px] text-gray-500">Nothing to do right now. Max will send your next offer here.</p>
        </section>

        <section class="swapp-card md:col-span-2">
          <div class="border-b border-gray-100 px-5 py-3.5"><h2 class="text-[15px] font-bold text-gray-900">How the programme works</h2></div>
          <ol class="space-y-2.5 px-5 py-4 text-[13px] text-gray-700">
            <li v-for="(name, i) in STEPS" :key="name" class="flex gap-3"><span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-dark text-[11px] font-bold text-white">{{ i + 1 }}</span><span><b>{{ name }}.</b> {{ ['You review the terms and accept in one click.', 'Your brief unlocks: angle, must-haves, deadline.', 'You submit your draft (file or link) here.', 'Max reviews within 48 hours, one round of tweaks max.', 'You post, paste the link, sign-ups are tracked 30 days.', 'You send your invoice, the transfer goes out within 5 working days.'][i] }}</span></li>
          </ol>
        </section>
      </div>

      <section class="mt-5">
        <div class="mb-2 flex items-center justify-between"><h2 class="text-[15px] font-bold text-gray-900">Your campaigns</h2><NuxtLink :to="`${base}/campaigns`" class="text-[13px] font-semibold text-green-dark underline">See all</NuxtLink></div>
        <div v-if="collabs.length" class="grid gap-3 md:grid-cols-2">
          <NuxtLink v-for="c in collabs.slice(0, 4)" :key="c.id" :to="`${base}/campaigns/${c.id}`" class="swapp-card flex gap-4 p-4 hover:border-green-dark">
            <span class="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-green-dark"><img src="/assets/keymark.svg" alt="" class="h-7 w-7" /></span>
            <span class="min-w-0 flex-1">
              <StatusPill :status="c.status" />
              <span class="mt-1 block truncate text-[15px] font-bold text-gray-900">{{ c.title }}</span>
              <span class="block text-[12px] text-gray-500">{{ c.deliverables || 'Content for &Swapp' }} · {{ money(c.money.total, c.currency) }}</span>
            </span>
          </NuxtLink>
        </div>
        <p v-else class="swapp-card p-5 text-[14px] text-gray-500">No campaign yet. Max will send your first offer here.</p>
      </section>
    </template>

    <!-- ===== Campaigns : la liste ===== -->
    <template v-else-if="section === 'campaigns' && !detailId">
      <p class="text-[15px] text-gray-600">Each campaign has its terms, its brief and its own tracking. Open one to see where it stands.</p>
      <div v-if="collabs.length" class="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <NuxtLink v-for="c in collabs" :key="c.id" :to="`${base}/campaigns/${c.id}`" class="swapp-card hover:border-green-dark">
          <div class="relative flex h-28 items-end bg-gradient-to-br from-green-dark to-[#1f3f2d] p-4"><img src="/assets/keymark.svg" alt="" class="absolute right-4 top-4 h-8 w-8 opacity-80" /><span class="pill bg-white/90 text-green-dark">{{ c.deliverables || 'Content' }}</span></div>
          <div class="p-4">
            <StatusPill :status="c.status" />
            <h2 class="mt-1.5 text-[15px] font-bold text-gray-900">{{ c.title }}</h2>
            <div class="mt-3 grid grid-cols-2 gap-2 text-[12px] text-gray-500"><span>Fee<b class="block text-[14px] text-gray-900">{{ money(c.money.fixed + c.money.boost, c.currency) }}</b></span><span>Deadline<b class="block text-[14px] text-gray-900">{{ c.deadline || 'Flexible' }}</b></span></div>
            <div class="mt-3 flex gap-1"><span v-for="(name, i) in STEPS" :key="name" class="swapp-step-segment" :class="i < stepIndex(c) ? 'swapp-step-segment--done' : i === stepIndex(c) ? 'swapp-step-segment--current' : ''"></span></div>
            <p class="mt-1.5 text-[12px] text-gray-500">Step {{ Math.min(stepIndex(c) + 1, 6) }} of 6 · {{ STEPS[Math.min(stepIndex(c), 5)] }}</p>
          </div>
        </NuxtLink>
      </div>
      <p v-else class="swapp-card mt-4 p-5 text-[14px] text-gray-500">No campaign yet. Max will send your first offer here.</p>
    </template>

    <!-- ===== Campaigns : le détail (termes, brief, suivi) ===== -->
    <template v-else-if="section === 'campaigns' && detail">
      <NuxtLink :to="`${base}/campaigns`" class="inline-flex items-center gap-1 text-[13px] font-semibold text-gray-500 hover:text-green-dark"><span v-html="ICONS.back"></span> All campaigns</NuxtLink>
      <div class="mt-3 flex flex-wrap items-center gap-2"><StatusPill :status="detail.status" /><span class="text-[13px] text-gray-500">Campaign #{{ detail.id }} · offered {{ day(detail.offered_at) }}</span></div>

      <!-- Le suivi en 6 étapes -->
      <section class="swapp-card mt-4 p-5">
        <ol class="grid grid-cols-6 gap-1">
          <li v-for="(name, i) in STEPS" :key="name" class="flex flex-col items-center gap-1.5 text-center">
            <span class="flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold" :class="i < stepIndex(detail) ? 'bg-green-dark text-white' : i === stepIndex(detail) ? 'bg-yellow text-green-dark ring-4 ring-yellow/30' : 'bg-gray-100 text-gray-400'"><span v-if="i < stepIndex(detail)" v-html="ICONS.check"></span><template v-else>{{ i + 1 }}</template></span>
            <span class="text-[10px] font-semibold uppercase tracking-wide md:text-[11px]" :class="i <= stepIndex(detail) ? 'text-green-dark' : 'text-gray-400'">{{ name }}</span>
          </li>
        </ol>
        <p class="mt-4 rounded-lg bg-yellow/15 px-3 py-2 text-[13px] text-green-dark"><b>Next step:</b> {{ NEXT[detail.status] }}</p>
      </section>

      <div class="mt-4 grid gap-4 md:grid-cols-5">
        <div class="space-y-4 md:col-span-3">
          <!-- Les termes, comme un contrat -->
          <section class="swapp-card">
            <div class="flex items-center justify-between border-b border-gray-100 px-5 py-3.5"><h2 class="text-[15px] font-bold text-gray-900">Terms</h2><span v-if="detail.accepted_at" class="pill bg-green-light/40 text-green-dark">Accepted {{ short(detail.accepted_at) }}</span></div>
            <dl class="divide-y divide-gray-100 text-[14px]">
              <div class="flex justify-between gap-4 px-5 py-3"><dt class="text-gray-500">Deliverables</dt><dd class="text-right font-semibold text-gray-900">{{ detail.deliverables || 'Content for &Swapp' }}</dd></div>
              <div class="flex justify-between gap-4 px-5 py-3"><dt class="text-gray-500">Fixed fee</dt><dd class="font-semibold text-gray-900">{{ money(detail.fixed_amount, detail.currency) }}</dd></div>
              <div v-if="detail.boost_pct" class="flex justify-between gap-4 px-5 py-3"><dt class="text-gray-500">Paid usage rights, 30 days</dt><dd class="font-semibold text-gray-900">+{{ detail.boost_pct }}% ({{ money(detail.money.boost, detail.currency) }})</dd></div>
              <div v-if="detail.per_signup" class="flex justify-between gap-4 px-5 py-3"><dt class="text-gray-500">Performance bonus</dt><dd class="text-right font-semibold text-gray-900">{{ money(detail.per_signup, detail.currency) }} per sign-up<span v-if="detail.per_waitlist"> · {{ money(detail.per_waitlist, detail.currency) }} per waitlist</span><span v-if="detail.cap_variable" class="block text-[12px] font-normal text-gray-500">capped at {{ money(detail.cap_variable, detail.currency) }}</span></dd></div>
              <div class="flex justify-between gap-4 px-5 py-3"><dt class="text-gray-500">Deadline</dt><dd class="font-semibold text-gray-900">{{ detail.deadline || 'Flexible, agreed with Max' }}</dd></div>
              <div class="flex justify-between gap-4 px-5 py-3"><dt class="text-gray-500">Payment</dt><dd class="text-right font-semibold text-gray-900">Bank transfer on invoice<span class="block text-[12px] font-normal text-gray-500">within 5 working days</span></dd></div>
              <div class="flex justify-between gap-4 px-5 py-3"><dt class="text-gray-500">Review</dt><dd class="text-right font-semibold text-gray-900">Draft approved before posting<span class="block text-[12px] font-normal text-gray-500">feedback within 48 hours</span></dd></div>
            </dl>
            <div v-if="detail.status === 'offered'" class="border-t border-gray-100 px-5 py-4">
              <p class="text-[13px] text-gray-600">By accepting, you agree to the terms above and to the brief that unlocks right after.</p>
              <div class="mt-3 flex flex-col gap-2 sm:flex-row">
                <button class="btn-swapp px-5 py-2.5 text-[14px]" :disabled="!!busy" @click="accept(detail, true)">Accept the terms</button>
                <button class="btn-swapp-white px-5 py-2.5 text-[14px]" :disabled="!!busy" @click="accept(detail, false)">Decline</button>
              </div>
              <p v-if="errors[`accept-${detail.id}`]" class="mt-2 text-[13px] text-error">{{ errors[`accept-${detail.id}`] }}</p>
            </div>
          </section>

          <!-- Le brief -->
          <section class="swapp-card">
            <div class="border-b border-gray-100 px-5 py-3.5"><h2 class="text-[15px] font-bold text-gray-900">Brief</h2></div>
            <div v-if="detail.status === 'offered' || detail.status === 'declined'" class="px-5 py-6 text-center text-[14px] text-gray-500">{{ detail.status === 'declined' ? 'You declined this campaign.' : 'The brief unlocks once you accept the terms.' }}</div>
            <div v-else-if="detail.brief" class="whitespace-pre-wrap px-5 py-4 text-[14px] leading-relaxed text-gray-800">{{ detail.brief }}</div>
            <div v-else class="px-5 py-4 text-[14px] text-gray-500">Max is writing your brief. You will get an email when it is ready.</div>
          </section>
        </div>

        <div class="space-y-4 md:col-span-2">
          <section class="swapp-card">
            <div class="border-b border-gray-100 px-5 py-3.5"><h2 class="text-[15px] font-bold text-gray-900">Activity</h2></div>
            <ol class="px-5 py-4">
              <li v-for="([at, what], i) in timeline(detail)" :key="what" class="relative flex gap-3 pb-4 last:pb-0">
                <span v-if="i < timeline(detail).length - 1" class="absolute left-[7px] top-4 h-full w-px bg-gray-200"></span>
                <span class="relative mt-1 h-[15px] w-[15px] shrink-0 rounded-full border-2 border-green-dark bg-white"></span>
                <span><span class="block text-[13px] font-semibold text-gray-900">{{ what }}</span><span class="block text-[12px] text-gray-500">{{ day(at) }}</span></span>
              </li>
            </ol>
          </section>
          <section class="swapp-card p-5">
            <p class="label-soft">Earnings on this campaign</p>
            <p class="mt-1 text-2xl font-extrabold text-gray-900">{{ money(detail.money.total, detail.currency) }}</p>
            <p class="text-[12px] text-gray-500">{{ money(detail.money.fixed + detail.money.boost, detail.currency) }} fee + {{ money(detail.money.variable, detail.currency) }} bonus{{ detail.money.capped ? ' (capped)' : '' }}</p>
            <NuxtLink :to="`${base}/payments`" class="mt-3 inline-block text-[13px] font-semibold text-green-dark underline">See payments</NuxtLink>
          </section>
          <section class="swapp-card p-5">
            <p class="label-soft">Shortcuts</p>
            <ul class="mt-2 space-y-1.5 text-[13px]">
              <li v-if="canDraft(detail)"><NuxtLink :to="`${base}/content`" class="font-semibold text-green-dark underline">Submit your draft</NuxtLink></li>
              <li v-if="detail.status === 'approved'"><NuxtLink :to="`${base}/content`" class="font-semibold text-green-dark underline">Share the link of your post</NuxtLink></li>
              <li><NuxtLink :to="`${base}/tracking`" class="font-semibold text-green-dark underline">Your tracking link</NuxtLink></li>
              <li><a href="mailto:maxime.barret@andswapp.com" class="font-semibold text-green-dark underline">Email Max a question</a></li>
            </ul>
          </section>
        </div>
      </div>
    </template>
    <template v-else-if="section === 'campaigns'">
      <p class="swapp-card p-5 text-[14px] text-gray-500">This campaign does not exist. <NuxtLink :to="`${base}/campaigns`" class="underline">Back to your campaigns</NuxtLink>.</p>
    </template>

    <!-- ===== Content : les livrables ===== -->
    <template v-else-if="section === 'content'">
      <p class="text-[15px] text-gray-600">One deliverable per campaign. Submit your draft here, get it approved, then share the link once it is live.</p>
      <div class="mt-4 space-y-4">
        <section v-for="c in collabs.filter((c) => c.status !== 'declined')" :key="c.id" class="swapp-card">
          <div class="flex flex-wrap items-center gap-2 border-b border-gray-100 px-5 py-3.5">
            <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-green-dark text-white" v-html="ICONS.content"></span>
            <span class="min-w-0 flex-1"><span class="block truncate text-[15px] font-bold text-gray-900">{{ c.deliverables || 'Content' }}</span><span class="block truncate text-[12px] text-gray-500">{{ c.title }}<span v-if="c.deadline"> · due {{ c.deadline }}</span></span></span>
            <span class="pill" :class="['approved', 'published', 'invoiced', 'paid'].includes(c.status) ? 'bg-green-dark text-white' : c.status === 'changes_requested' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-600'">{{ DELIVERABLE_STATE[c.status] }}</span>
          </div>

          <div v-if="c.status === 'offered'" class="px-5 py-5 text-[14px] text-gray-500">Accept the terms in <NuxtLink :to="`${base}/campaigns/${c.id}`" class="underline">Campaigns</NuxtLink> to unlock this deliverable.</div>

          <div v-else-if="canDraft(c)" class="px-5 py-4">
            <div v-if="c.status === 'changes_requested' && c.feedback" class="mb-3 rounded-lg bg-orange-50 p-3 text-[14px] text-orange-900"><b>Max asked for one tweak:</b> {{ c.feedback }}</div>
            <p v-if="c.status === 'draft_submitted'" class="mb-3 rounded-lg bg-green-light/30 p-3 text-[14px] text-green-dark">Draft submitted on {{ day(c.draft_at) }}. Max is reviewing it, you will get an email within 48 hours. You can still replace it below.</p>
            <p class="label-soft">{{ c.status === 'changes_requested' ? 'Submit the new version' : c.status === 'draft_submitted' ? 'Replace your draft' : 'Submit your draft' }}</p>
            <p class="mt-1 text-[13px] text-gray-500">Video or images, 200 MB max. Or paste a link (Drive, WeTransfer, a private post).</p>
            <label class="mt-3 flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-gray-300 px-4 py-6 text-center hover:border-green-dark">
              <span class="text-green-dark" v-html="ICONS.upload"></span>
              <span class="text-[14px] font-semibold text-gray-800">{{ form(c.id).file ? form(c.id).file.name : 'Choose a file' }}</span>
              <span class="text-[12px] text-gray-500">MP4, MOV, JPG, PNG</span>
              <input type="file" accept="video/*,image/*" class="hidden" @change="form(c.id).file = $event.target.files[0] || null" />
            </label>
            <input v-model="form(c.id).url" type="url" placeholder="Or a link to your draft" class="input-soft mt-2" />
            <textarea v-model="form(c.id).note" rows="2" placeholder="A note for Max (optional)" class="input-soft mt-2"></textarea>
            <div v-if="form(c.id).progress" class="mt-2 h-1.5 w-full overflow-hidden rounded bg-gray-200"><div class="h-full bg-green-dark" :style="{ width: form(c.id).progress + '%' }"></div></div>
            <button class="btn-swapp mt-3 px-5 py-2.5 text-[14px]" :disabled="!!busy" @click="sendDraft(c)">{{ busy === `draft-${c.id}` ? 'Uploading…' : 'Submit for review' }}</button>
            <p v-if="errors[`draft-${c.id}`]" class="mt-2 text-[13px] text-error">{{ errors[`draft-${c.id}`] }}</p>
          </div>

          <div v-else-if="c.status === 'approved'" class="px-5 py-4">
            <p class="rounded-lg bg-green-light/30 p-3 text-[14px] text-green-dark">Approved on {{ day(c.approved_at) }}. You can post it as is.</p>
            <p class="label-soft mt-4">Once it is live, paste the link</p>
            <div class="mt-2 flex flex-col gap-2 sm:flex-row">
              <input v-model="form(c.id).post" type="url" placeholder="https://www.instagram.com/reel/…" class="input-soft" />
              <button class="btn-swapp shrink-0 px-5 py-2.5 text-[14px]" :disabled="!!busy" @click="sendPost(c)">Mark as live</button>
            </div>
            <p v-if="errors[`post-${c.id}`]" class="mt-2 text-[13px] text-error">{{ errors[`post-${c.id}`] }}</p>
          </div>

          <div v-else class="px-5 py-4 text-[14px] text-gray-700">
            Live since {{ day(c.published_at) }}: <a :href="c.published_url" target="_blank" rel="noopener" class="break-all font-semibold text-green-dark underline">{{ c.published_url }}</a>
            <p class="mt-1 text-[12px] text-gray-500">Sign-ups through your link are tracked for 30 days from this date. See <NuxtLink :to="`${base}/tracking`" class="underline">Tracking</NuxtLink>.</p>
          </div>
        </section>
        <p v-if="!collabs.length" class="swapp-card p-5 text-[14px] text-gray-500">No deliverable yet.</p>
      </div>
    </template>

    <!-- ===== Tracking ===== -->
    <template v-else-if="section === 'tracking'">
      <p class="text-[15px] text-gray-600">Every sign-up that comes through your link is counted here and feeds your performance bonus.</p>
      <div class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        <div class="swapp-card p-4"><p class="label-soft">Sign-ups</p><p class="mt-1 text-2xl font-extrabold text-gray-900">{{ totals.signups }}</p></div>
        <div class="swapp-card p-4"><p class="label-soft">Waitlist</p><p class="mt-1 text-2xl font-extrabold text-gray-900">{{ totals.waitlist }}</p></div>
        <div class="swapp-card col-span-2 p-4 md:col-span-1"><p class="label-soft">Bonus earned</p><p class="mt-1 text-2xl font-extrabold text-green-dark">{{ money(sum(collabs, (c) => c.money.variable), totals.currency) }}</p></div>
      </div>

      <section class="swapp-card mt-4">
        <div class="border-b border-gray-100 px-5 py-3.5"><h2 class="text-[15px] font-bold text-gray-900">Your tracking link</h2></div>
        <div class="px-5 py-4">
          <template v-if="personalLink">
            <p class="text-[13px] text-gray-600">Put this link in your bio, your story sticker and your caption. Every sign-up that starts from it is yours.</p>
            <div class="mt-2 flex flex-col gap-2 sm:flex-row">
              <input :value="personalLink" readonly class="input-soft font-mono text-[14px]" />
              <button class="btn-swapp-white shrink-0 px-4 py-2.5 text-[14px]" @click="copy('link', personalLink)">{{ copied === 'link' ? 'Copied' : 'Copy link' }}</button>
            </div>
            <p class="mt-2 text-[12px] text-gray-500">Code: <b>{{ me.code }}</b>. People can also type it on andswapp.com if they cannot click.</p>
          </template>
          <p v-else class="text-[14px] text-gray-500">Your personal link is being set up. Max will email you when it is live.</p>
        </div>
      </section>

      <section class="swapp-card mt-4">
        <div class="border-b border-gray-100 px-5 py-3.5"><h2 class="text-[15px] font-bold text-gray-900">By campaign</h2></div>
        <table class="w-full text-[13px]">
          <thead class="text-left text-[11px] uppercase tracking-wide text-gray-500"><tr><th class="px-5 py-2.5">Campaign</th><th class="px-3 py-2.5">Live since</th><th class="px-3 py-2.5 text-right">Sign-ups</th><th class="hidden px-3 py-2.5 text-right sm:table-cell">Waitlist</th><th class="px-5 py-2.5 text-right">Bonus</th></tr></thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="c in collabs.filter((c) => c.status !== 'declined')" :key="c.id">
              <td class="px-5 py-3 font-semibold text-gray-900">{{ c.title }}</td>
              <td class="px-3 py-3 text-gray-600">{{ c.published_at ? short(c.published_at) : 'Not live yet' }}</td>
              <td class="px-3 py-3 text-right font-semibold text-gray-900">{{ c.signups }}</td>
              <td class="hidden px-3 py-3 text-right text-gray-600 sm:table-cell">{{ c.waitlist }}</td>
              <td class="px-5 py-3 text-right font-semibold text-green-dark">{{ money(c.money.variable, c.currency) }}<span v-if="c.money.capped" class="block text-[11px] font-normal text-gray-500">cap reached</span></td>
            </tr>
            <tr v-if="!collabs.length"><td colspan="5" class="px-5 py-5 text-gray-500">Nothing tracked yet.</td></tr>
          </tbody>
        </table>
        <p class="border-t border-gray-100 px-5 py-3 text-[12px] text-gray-500">Counts are updated by &Swapp from the sign-up data, usually within a day. The window is 30 days from the day your content goes live.</p>
      </section>

      <section class="swapp-card mt-4 flex items-center gap-4 p-5">
        <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500" v-html="ICONS.instagram"></span>
        <span><span class="block text-[14px] font-semibold text-gray-900">Instagram insights <span class="pill ml-1 bg-gray-100 text-gray-500">Coming soon</span></span><span class="block text-[13px] text-gray-500">Connecting your account to pull views and reach is on our roadmap. For now, Max reads the sign-ups from your link.</span></span>
      </section>
    </template>

    <!-- ===== Payments ===== -->
    <template v-else-if="section === 'payments'">
      <p class="text-[15px] text-gray-600">What you have earned, what is being paid, and what you need to send us.</p>
      <div class="mt-4 grid grid-cols-3 gap-3">
        <div class="swapp-card p-4"><p class="label-soft">Upcoming</p><p class="mt-1 text-xl font-extrabold text-gray-900 md:text-2xl">{{ money(totals.upcoming, totals.currency) }}</p><p class="text-[11px] text-gray-500">campaigns in progress</p></div>
        <div class="swapp-card p-4"><p class="label-soft">Pending</p><p class="mt-1 text-xl font-extrabold text-gray-900 md:text-2xl">{{ money(totals.pending, totals.currency) }}</p><p class="text-[11px] text-gray-500">live, to be invoiced or paid</p></div>
        <div class="swapp-card p-4"><p class="label-soft">Paid</p><p class="mt-1 text-xl font-extrabold text-green-dark md:text-2xl">{{ money(totals.paid, totals.currency) }}</p><p class="text-[11px] text-gray-500">to date</p></div>
      </div>

      <section class="swapp-card mt-4">
        <div class="border-b border-gray-100 px-5 py-3.5"><h2 class="text-[15px] font-bold text-gray-900">Statements</h2></div>
        <div v-if="collabs.some(live)" class="divide-y divide-gray-100">
          <div v-for="c in collabs.filter(live)" :key="c.id" class="px-5 py-4">
            <div class="flex flex-wrap items-center gap-2"><span class="flex-1 text-[14px] font-bold text-gray-900">{{ c.title }}</span><StatusPill :status="c.status" /></div>
            <dl class="mt-2 space-y-1 text-[13px] sm:max-w-md">
              <div class="flex justify-between gap-3 "><dt class="text-gray-500">Fixed fee</dt><dd class="text-gray-900">{{ money(c.money.fixed, c.currency) }}</dd></div>
              <div v-if="c.boost_pct" class="flex justify-between gap-3 "><dt class="text-gray-500">Paid usage (+{{ c.boost_pct }}%)</dt><dd class="text-gray-900">{{ money(c.money.boost, c.currency) }}</dd></div>
              <div v-if="c.per_signup" class="flex justify-between gap-3 "><dt class="text-gray-500">Bonus ({{ c.signups }} sign-ups{{ c.waitlist ? `, ${c.waitlist} waitlist` : '' }})</dt><dd class="text-gray-900">{{ money(c.money.variable, c.currency) }}{{ c.money.capped ? ' (capped)' : '' }}</dd></div>
              <div class="flex justify-between gap-3 border-t border-gray-100 pt-1 sm:col-span-2 "><dt class="font-semibold text-gray-900">Total</dt><dd class="font-extrabold text-gray-900">{{ money(c.money.total, c.currency) }}</dd></div>
            </dl>
            <p v-if="c.status === 'paid'" class="mt-3 rounded-lg bg-green-light/30 px-3 py-2 text-[13px] text-green-dark">Paid on {{ day(c.paid_at) }}: {{ money(c.paid_amount ?? c.money.total, c.currency) }}. Thank you.</p>
            <p v-else-if="c.invoice_key" class="mt-3 rounded-lg bg-green-light/30 px-3 py-2 text-[13px] text-green-dark">Invoice received on {{ day(c.invoice_at) }}. The transfer goes out within 5 working days.</p>
            <div v-else class="mt-3 rounded-lg bg-yellow/15 p-3">
              <p class="text-[13px] text-green-dark"><b>Action needed:</b> send an invoice for <b>{{ money(c.money.total, c.currency) }}</b> made out to &Swapp (PDF or image).<span v-if="totals.signups && c.status === 'published'"> The bonus is final 30 days after posting, you can also invoice then.</span></p>
              <label class="btn-swapp mt-2 inline-block cursor-pointer px-4 py-2 text-[13px]">{{ busy === `invoice-${c.id}` ? 'Uploading…' : 'Upload invoice' }}<input type="file" accept="application/pdf,image/*" class="hidden" @change="$event.target.files[0] && sendInvoice(c, $event.target.files[0])" /></label>
              <p v-if="errors[`invoice-${c.id}`]" class="mt-2 text-[13px] text-error">{{ errors[`invoice-${c.id}`] }}</p>
            </div>
          </div>
        </div>
        <p v-else class="px-5 py-5 text-[14px] text-gray-500">Your first statement appears here once your content is live.</p>
      </section>

      <section class="swapp-card mt-4">
        <div class="flex items-center justify-between border-b border-gray-100 px-5 py-3.5"><h2 class="text-[15px] font-bold text-gray-900">Payout method</h2><span class="pill" :class="me.has_payout ? 'bg-green-light/40 text-green-dark' : 'bg-yellow/30 text-green-dark'">{{ me.has_payout ? 'Saved' : 'To add' }}</span></div>
        <div class="px-5 py-4">
          <p class="text-[14px] text-gray-700">Bank transfer<span v-if="me.has_payout"> to the account ending {{ me.payout_hint }}</span>. <span v-if="!me.has_payout">Add your details so the transfer can go out as soon as your invoice is in.</span></p>
          <button class="mt-2 text-[13px] font-semibold text-green-dark underline" @click="pay.open = !pay.open">{{ me.has_payout ? 'Change details' : 'Add bank details' }}</button>
          <form v-if="pay.open" class="mt-3 space-y-2 sm:max-w-md" @submit.prevent="savePayout">
            <input v-model="pay.payout_name" required placeholder="Name on the account" class="input-soft" />
            <input v-model="pay.payout_details" required placeholder="Sort code + account number, or IBAN" class="input-soft" />
            <p class="text-[12px] text-gray-500">Stored for your transfers only, never shown in full again.</p>
            <button type="submit" class="btn-swapp px-5 py-2 text-[14px]" :disabled="!!busy">Save</button>
            <p v-if="errors.payout" class="text-[13px] text-error">{{ errors.payout }}</p>
          </form>
        </div>
      </section>
    </template>

    <!-- ===== Profile ===== -->
    <template v-else-if="section === 'profile'">
      <div class="grid gap-4 md:grid-cols-5">
        <section class="swapp-card md:col-span-3">
          <div class="border-b border-gray-100 px-5 py-3.5"><h2 class="text-[15px] font-bold text-gray-900">Your profile</h2></div>
          <dl class="divide-y divide-gray-100 text-[14px]">
            <div class="flex justify-between gap-4 px-5 py-3"><dt class="text-gray-500">Name</dt><dd class="font-semibold text-gray-900">{{ me.name }}</dd></div>
            <div class="flex justify-between gap-4 px-5 py-3"><dt class="text-gray-500">Instagram</dt><dd class="font-semibold text-gray-900">{{ me.handle || 'Not set' }}</dd></div>
            <div class="flex justify-between gap-4 px-5 py-3"><dt class="text-gray-500">Email</dt><dd class="font-semibold text-gray-900">{{ me.email }}</dd></div>
            <div class="flex justify-between gap-4 px-5 py-3"><dt class="text-gray-500">City</dt><dd class="font-semibold text-gray-900">{{ me.city || 'Not set' }}</dd></div>
            <div class="flex justify-between gap-4 px-5 py-3"><dt class="text-gray-500">Tracking code</dt><dd class="font-semibold text-gray-900">{{ me.code || 'Being set up' }}</dd></div>
            <div class="flex justify-between gap-4 px-5 py-3"><dt class="text-gray-500">Member since</dt><dd class="font-semibold text-gray-900">{{ day(me.created_at) }}</dd></div>
          </dl>
          <p class="border-t border-gray-100 px-5 py-3 text-[12px] text-gray-500">Something to change? <a href="mailto:maxime.barret@andswapp.com" class="underline">Email Max</a>, he updates it for you.</p>
        </section>
        <div class="space-y-4 md:col-span-2">
          <section class="swapp-card flex items-start gap-3 p-5">
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500" v-html="ICONS.instagram"></span>
            <span><span class="block text-[14px] font-semibold text-gray-900">Connect Instagram <span class="pill ml-1 bg-gray-100 text-gray-500">Coming soon</span></span><span class="mt-0.5 block text-[13px] text-gray-500">Linking your account will pull your insights into Tracking automatically.</span></span>
          </section>
          <section class="swapp-card p-5">
            <p class="label-soft">Your private link</p>
            <p class="mt-1 text-[13px] text-gray-600">This space opens from the link in your emails. Keep it to yourself: whoever has it sees your campaigns.</p>
            <button class="btn-swapp-white mt-3 px-4 py-2 text-[13px]" @click="copy('space', `https://creators.andswapp.com${base}`)">{{ copied === 'space' ? 'Copied' : 'Copy my link' }}</button>
          </section>
        </div>
      </div>
    </template>

    <template v-else>
      <p class="swapp-card p-5 text-[14px] text-gray-500">This page does not exist. <NuxtLink :to="base" class="underline">Back to your dashboard</NuxtLink>.</p>
    </template>
  </CreatorShell>
</template>
