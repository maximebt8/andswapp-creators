<script setup>
// L'espace d'une créatrice : ses collabs, l'offre à accepter, le brief, le dépôt du brouillon, le lien du post, le fil
// de messages, ses stats et son relevé. Un seul écran, du haut vers le bas, dans l'ordre où ça se passe.
import { money, payout } from '~~/shared/utils/collab'

const route = useRoute()
const token = computed(() => String(route.params.token ?? ''))
useHead({ title: 'My &Swapp space' })

const { data, error, refresh } = await useFetch('/api/me', { query: { t: token }, key: 'me' })
const me = computed(() => data.value?.me)
const collabs = computed(() => data.value?.collabs ?? [])
const messagesOf = (id) => (data.value?.messages ?? []).filter((m) => m.collab_id === id)

const busy = ref('')
const errors = reactive({})
const forms = reactive({})
const form = (id) => (forms[id] ??= { note: '', url: '', post: '', message: '', file: null, progress: 0 })

const call = async (key, fn) => {
  if (busy.value) return
  busy.value = key
  errors[key] = ''
  try {
    await fn()
    await refresh()
  } catch (e) {
    errors[key] = e?.data?.statusMessage || e?.statusMessage || 'Something went wrong. Try again.'
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
const sendMessage = (c) =>
  call(`msg-${c.id}`, async () => {
    await $fetch('/api/message', { method: 'POST', body: { t: token.value, collab: c.id, body: form(c.id).message } })
    form(c.id).message = ''
  })
const sendInvoice = (c, file) => call(`invoice-${c.id}`, () => upload(c, file, 'invoice'))

const pay = reactive({ payout_name: '', payout_details: '', invoice_mode: 'self', open: false })
const savePayout = () =>
  call('payout', async () => {
    await $fetch('/api/payout', { method: 'POST', body: { t: token.value, ...pay } })
    pay.open = false
  })

const day = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '')
const canDraft = (c) => ['accepted', 'changes_requested', 'draft_submitted'].includes(c.status)
const needsStatement = (c) => ['published', 'invoiced', 'paid'].includes(c.status)
</script>

<template>
  <div class="min-h-dvh bg-base-200">
    <div class="mx-auto flex min-h-dvh w-full max-w-xl flex-col bg-white md:border-x md:border-gray-200">
      <SwappHeader subtitle="Creators" />

      <main v-if="error || !me" class="flex flex-1 flex-col justify-center px-6 pb-16">
        <h1 class="text-2xl font-extrabold text-green-dark">This link does not work</h1>
        <p class="mt-2 text-[15px] text-gray-600">Open the link from the email Max sent you, or <NuxtLink to="/" class="underline">ask for it again</NuxtLink>.</p>
      </main>

      <main v-else class="flex-1 px-5 pb-16 md:px-8">
        <h1 class="mt-2 text-2xl font-extrabold leading-tight text-green-dark">Hi {{ me.name.split(' ')[0] }}</h1>
        <p class="mt-1 text-[15px] text-gray-600">Everything about your collab with &Swapp is here. This page is yours only.</p>

        <section v-for="c in collabs" :key="c.id" class="mt-6">
          <div class="card-soft">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="label-soft">Collab</p>
                <h2 class="text-lg font-bold text-green-dark">{{ c.title }}</h2>
              </div>
              <StatusPill :status="c.status" />
            </div>

            <!-- L'offre -->
            <div class="mt-4 rounded-xl bg-base-200 p-4">
              <p class="label-soft">Your offer</p>
              <p class="mt-1 text-[15px] text-gray-800">{{ c.deliverables || 'Content for &Swapp' }}</p>
              <ul class="mt-2 space-y-1 text-[14px] text-gray-700">
                <li>Fixed fee: <b>{{ money(c.fixed_amount, c.currency) }}</b></li>
                <li v-if="c.boost_pct">Paid usage, 30 days: <b>+{{ c.boost_pct }}%</b> ({{ money(c.money.boost, c.currency) }})</li>
                <li v-if="c.per_signup">Per London → Paris sign-up through your link: <b>{{ money(c.per_signup, c.currency) }}</b><span v-if="c.per_waitlist">, per waitlist sign-up: <b>{{ money(c.per_waitlist, c.currency) }}</b></span><span v-if="c.cap_variable">, capped at {{ money(c.cap_variable, c.currency) }}</span></li>
                <li v-if="c.deadline">Target date: <b>{{ c.deadline }}</b></li>
              </ul>
              <div v-if="c.status === 'offered'" class="mt-4 flex flex-col gap-2 sm:flex-row">
                <button class="btn-swapp px-5 py-2.5 text-[14px]" :disabled="!!busy" @click="accept(c, true)">Accept the offer</button>
                <button class="btn-swapp-white px-5 py-2.5 text-[14px]" :disabled="!!busy" @click="accept(c, false)">Not this time</button>
              </div>
              <p v-else-if="c.accepted_at" class="mt-2 text-[13px] text-gray-500">Accepted on {{ day(c.accepted_at) }}.</p>
              <p v-if="errors[`accept-${c.id}`]" class="mt-2 text-[13px] text-error">{{ errors[`accept-${c.id}`] }}</p>
            </div>

            <!-- Le brief -->
            <div v-if="c.status !== 'offered' && c.status !== 'declined' && c.brief" class="mt-4">
              <p class="label-soft">Your brief</p>
              <div class="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-gray-800">{{ c.brief }}</div>
            </div>

            <!-- Le brouillon -->
            <div v-if="canDraft(c)" class="mt-4 rounded-xl border border-dashed border-gray-300 p-4">
              <p class="label-soft">{{ c.status === 'changes_requested' ? 'Your new version' : c.status === 'draft_submitted' ? 'Your draft' : 'Send your draft' }}</p>
              <div v-if="c.status === 'changes_requested' && c.feedback" class="mt-2 rounded-lg bg-orange-50 p-3 text-[14px] text-orange-900"><b>Max asked:</b> {{ c.feedback }}</div>
              <p v-if="c.status === 'draft_submitted'" class="mt-1 text-[14px] text-gray-600">Sent on {{ day(c.draft_at) }}. Max is having a look. You can send a new version if you want.</p>
              <p v-else class="mt-1 text-[14px] text-gray-600">Upload the video or images (200 MB max), or paste a link (Drive, WeTransfer, a private post).</p>
              <input type="file" accept="video/*,image/*" class="file-input file-input-sm mt-3 w-full" @change="form(c.id).file = $event.target.files[0] || null" />
              <input v-model="form(c.id).url" type="url" placeholder="Or a link to your draft" class="input-soft mt-2" />
              <textarea v-model="form(c.id).note" rows="2" placeholder="A word for Max (optional)" class="input-soft mt-2"></textarea>
              <div v-if="form(c.id).progress" class="mt-2 h-1.5 w-full overflow-hidden rounded bg-gray-200"><div class="h-full bg-green-dark" :style="{ width: form(c.id).progress + '%' }"></div></div>
              <button class="btn-swapp mt-3 px-5 py-2.5 text-[14px]" :disabled="!!busy" @click="sendDraft(c)">{{ busy === `draft-${c.id}` ? 'Sending…' : 'Send to Max' }}</button>
              <p v-if="errors[`draft-${c.id}`]" class="mt-2 text-[13px] text-error">{{ errors[`draft-${c.id}`] }}</p>
            </div>

            <!-- Publié -->
            <div v-if="c.status === 'approved' || c.status === 'published'" class="mt-4 rounded-xl bg-green-light/30 p-4">
              <p class="label-soft">{{ c.status === 'approved' ? 'Approved, you can post' : 'Live' }}</p>
              <p v-if="c.status === 'approved'" class="mt-1 text-[14px] text-gray-700">Once it is live, paste the link to the post here.</p>
              <p v-else class="mt-1 text-[14px] text-gray-700">Posted on {{ day(c.published_at) }}: <a :href="c.published_url" target="_blank" rel="noopener" class="underline">{{ c.published_url }}</a></p>
              <div v-if="c.status === 'approved'" class="mt-3 flex flex-col gap-2 sm:flex-row">
                <input v-model="form(c.id).post" type="url" placeholder="https://www.instagram.com/reel/…" class="input-soft" />
                <button class="btn-swapp px-5 py-2.5 text-[14px]" :disabled="!!busy" @click="sendPost(c)">It's live</button>
              </div>
              <p v-if="errors[`post-${c.id}`]" class="mt-2 text-[13px] text-error">{{ errors[`post-${c.id}`] }}</p>
            </div>

            <!-- Stats et relevé -->
            <div v-if="needsStatement(c) || c.per_signup" class="mt-4 grid grid-cols-2 gap-2">
              <div class="rounded-xl bg-base-200 p-3">
                <p class="label-soft">Sign-ups via your link</p>
                <p class="text-2xl font-extrabold text-green-dark">{{ c.signups }}</p>
                <p v-if="c.waitlist" class="text-[12px] text-gray-500">+ {{ c.waitlist }} on the waitlist</p>
              </div>
              <div class="rounded-xl bg-base-200 p-3">
                <p class="label-soft">Your total so far</p>
                <p class="text-2xl font-extrabold text-green-dark">{{ money(c.money.total, c.currency) }}</p>
                <p class="text-[12px] text-gray-500">{{ money(c.money.fixed + c.money.boost, c.currency) }} fixed + {{ money(c.money.variable, c.currency) }} variable{{ c.money.capped ? ' (capped)' : '' }}</p>
              </div>
            </div>

            <!-- Paiement -->
            <div v-if="needsStatement(c)" class="mt-4 rounded-xl border border-gray-200 p-4">
              <p class="label-soft">Payment</p>
              <p v-if="c.status === 'paid'" class="mt-1 text-[14px] text-green-dark">Paid on {{ day(c.paid_at) }}: {{ money(c.paid_amount ?? c.money.total, c.currency) }}. Thank you.</p>
              <template v-else>
                <p class="mt-1 text-[14px] text-gray-700">Send us an invoice for <b>{{ money(c.money.total, c.currency) }}</b> made out to &Swapp, and the transfer goes out.</p>
                <p v-if="c.invoice_key" class="mt-1 text-[13px] text-green-dark">Invoice received on {{ day(c.invoice_at) }}. Max is on it.</p>
                <input type="file" accept="application/pdf,image/*" class="file-input file-input-sm mt-3 w-full" @change="$event.target.files[0] && sendInvoice(c, $event.target.files[0])" />
                <p v-if="errors[`invoice-${c.id}`]" class="mt-2 text-[13px] text-error">{{ errors[`invoice-${c.id}`] }}</p>
                <p class="mt-3 text-[13px] text-gray-500">
                  Bank details: <span v-if="me.has_payout">saved ({{ me.payout_hint }}).</span><span v-else>not saved yet.</span>
                  <button class="underline" @click="pay.open = !pay.open">{{ me.has_payout ? 'Change' : 'Add them' }}</button>
                </p>
                <form v-if="pay.open" class="mt-2 space-y-2" @submit.prevent="savePayout">
                  <input v-model="pay.payout_name" required placeholder="Name on the account" class="input-soft" />
                  <input v-model="pay.payout_details" required placeholder="Sort code + account number, or IBAN" class="input-soft" />
                  <button type="submit" class="btn-swapp px-5 py-2 text-[14px]" :disabled="!!busy">Save</button>
                  <p v-if="errors.payout" class="text-[13px] text-error">{{ errors.payout }}</p>
                </form>
              </template>
            </div>

            <!-- Le fil -->
            <div v-if="c.status !== 'declined'" class="mt-4">
              <p class="label-soft">Messages with Max</p>
              <div class="mt-2 space-y-2">
                <div v-for="m in messagesOf(c.id)" :key="m.id" class="rounded-xl px-3 py-2 text-[14px]" :class="m.author === 'creator' ? 'ml-8 bg-green-light/30' : 'mr-8 bg-base-200'">
                  <p class="whitespace-pre-wrap">{{ m.body }}</p>
                  <p class="mt-1 text-[11px] text-gray-500">{{ m.author === 'creator' ? 'You' : 'Max' }} · {{ day(m.ts) }}</p>
                </div>
                <p v-if="!messagesOf(c.id).length" class="text-[13px] text-gray-400">No message yet.</p>
              </div>
              <div class="mt-2 flex gap-2">
                <input v-model="form(c.id).message" placeholder="Write to Max" class="input-soft" @keydown.enter.prevent="sendMessage(c)" />
                <button class="btn-swapp-white px-4 py-2 text-[14px]" :disabled="!!busy || !form(c.id).message" @click="sendMessage(c)">Send</button>
              </div>
              <p v-if="errors[`msg-${c.id}`]" class="mt-2 text-[13px] text-error">{{ errors[`msg-${c.id}`] }}</p>
            </div>
          </div>
        </section>

        <p v-if="!collabs.length" class="card-soft mt-6 text-[14px] text-gray-600">No collab yet. Max will send your offer here.</p>
        <p class="mt-10 text-[13px] text-gray-400">Questions? Reply to Max's email or write above. &Swapp · <a href="https://andswapp.com" class="underline">andswapp.com</a></p>
      </main>
    </div>
  </div>
</template>
