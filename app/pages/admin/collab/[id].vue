<script setup>
// Une collab vue par max : le brouillon à relire, les gestes (retouche, valide, compteurs, relevé, payée), le fil,
// la fiche de la créatrice avec ses coordonnées de virement, les mails liés.
import { money } from '~~/shared/utils/collab'

const route = useRoute()
const id = computed(() => Number(route.params.id))
const { data, error, refresh } = await useFetch('/api/admin/collab', { query: { id, k: route.query.k }, key: () => `collab-${id.value}` })
const c = computed(() => data.value?.collab)
const k = computed(() => data.value?.creator)
useHead({ title: () => (c.value ? `${k.value?.name} · ${c.value.title}` : 'Collab') })

const busy = ref('')
const msg = ref('')
const run = async (key, fn) => {
  if (busy.value) return
  busy.value = key
  msg.value = ''
  try {
    await fn()
    await refresh()
  } catch (e) {
    msg.value = e?.data?.statusMessage || e?.statusMessage || 'Raté, réessaie.'
  } finally {
    busy.value = ''
  }
}
const act = (action, extra = {}) => run(action, () => $fetch('/api/admin/action', { method: 'POST', body: { id: id.value, action, ...extra } }))
const f = reactive({ feedback: '', note: '', signups: 0, waitlist: 0, amount: null, message: '', notify: true, edit: false })
watchEffect(() => {
  if (c.value) {
    f.signups = c.value.signups
    f.waitlist = c.value.waitlist
  }
})
const edit = reactive({})
const openEdit = () => {
  Object.assign(edit, { id: c.value.id, creator_id: c.value.creator_id, title: c.value.title, currency: c.value.currency, fixed_amount: c.value.fixed_amount, boost_pct: c.value.boost_pct, per_signup: c.value.per_signup, per_waitlist: c.value.per_waitlist, cap_variable: c.value.cap_variable, deliverables: c.value.deliverables, deadline: c.value.deadline, brief: c.value.brief })
  f.edit = true
}
const saveEdit = () => run('edit', async () => {
  await $fetch('/api/admin/collab', { method: 'POST', body: edit })
  f.edit = false
})
const sendMessage = () => run('message', async () => {
  await $fetch('/api/admin/message', { method: 'POST', body: { id: id.value, body: f.message, notify: f.notify } })
  f.message = ''
})
const sendMail = (m) => run(`send-${m.id}`, () => $fetch('/api/admin/outbox', { method: 'POST', body: { id: m.id, action: 'send' } }))
const day = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '')
const media = (key) => `/api/media?key=${encodeURIComponent(key)}`
const isVideo = (key) => /\.(mp4|mov|webm|m4v)$/i.test(key ?? '')
</script>

<template>
  <div class="min-h-dvh bg-base-200">
    <SwappHeader subtitle="Créateurs · tableau de bord" to="/admin">
      <NuxtLink to="/admin" class="ml-auto text-[13px] text-green-dark underline">Retour</NuxtLink>
    </SwappHeader>
    <main v-if="error || !c" class="mx-auto max-w-3xl px-5 py-10 text-[15px] text-gray-600">Collab introuvable, ou il faut la clé (/admin?k=…).</main>
    <main v-else class="mx-auto grid max-w-5xl gap-6 px-5 pb-20 md:grid-cols-3 md:px-8">
      <p v-if="msg" class="rounded-xl bg-orange-50 px-4 py-2 text-[14px] text-orange-900 md:col-span-3">{{ msg }}</p>

      <div class="space-y-6 md:col-span-2">
        <section class="card-soft">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="label-soft">{{ k?.name }} <span v-if="k?.handle">@{{ k.handle }}</span></p>
              <h1 class="text-xl font-bold text-green-dark">{{ c.title }}</h1>
            </div>
            <StatusPill :status="c.status" lang="fr" />
          </div>
          <p class="mt-2 text-[14px] text-gray-700">{{ c.deliverables }} · {{ money(c.fixed_amount, c.currency) }} fixe<span v-if="c.boost_pct"> + {{ c.boost_pct }} % boost</span><span v-if="c.per_signup"> + {{ money(c.per_signup, c.currency) }}/inscrit<span v-if="c.per_waitlist">, {{ money(c.per_waitlist, c.currency) }}/liste</span><span v-if="c.cap_variable">, plafond {{ money(c.cap_variable, c.currency) }}</span></span><span v-if="c.deadline"> · pour le {{ c.deadline }}</span></p>
          <p class="mt-1 text-[13px] text-gray-500">Offre le {{ day(c.offered_at) }}<span v-if="c.accepted_at"> · acceptée le {{ day(c.accepted_at) }}</span><span v-if="c.published_at"> · publiée le {{ day(c.published_at) }}</span><span v-if="c.paid_at"> · payée le {{ day(c.paid_at) }}</span></p>
          <button class="mt-2 text-[13px] text-green-dark underline" @click="f.edit ? (f.edit = false) : openEdit()">{{ f.edit ? 'Fermer' : 'Modifier l\'offre ou le brief' }}</button>
          <form v-if="f.edit" class="mt-3 grid gap-2 rounded-xl bg-base-200 p-3 md:grid-cols-3" @submit.prevent="saveEdit">
            <input v-model="edit.title" class="input-soft md:col-span-2" />
            <select v-model="edit.currency" class="input-soft"><option>GBP</option><option>EUR</option><option>USD</option></select>
            <label class="text-[13px]">Fixe<input v-model.number="edit.fixed_amount" type="number" class="input-soft" /></label>
            <label class="text-[13px]">Boost %<input v-model.number="edit.boost_pct" type="number" class="input-soft" /></label>
            <label class="text-[13px]">Par inscrit<input v-model.number="edit.per_signup" type="number" step="0.5" class="input-soft" /></label>
            <label class="text-[13px]">Par liste<input v-model.number="edit.per_waitlist" type="number" step="0.5" class="input-soft" /></label>
            <label class="text-[13px]">Plafond<input v-model.number="edit.cap_variable" type="number" class="input-soft" /></label>
            <label class="text-[13px]">Date<input v-model="edit.deadline" type="date" class="input-soft" /></label>
            <input v-model="edit.deliverables" class="input-soft md:col-span-3" />
            <textarea v-model="edit.brief" rows="10" class="input-soft md:col-span-3"></textarea>
            <div class="md:col-span-3"><button type="submit" class="btn-swapp px-5 py-2 text-[14px]" :disabled="!!busy">Garder</button></div>
          </form>
          <div v-else-if="c.brief" class="mt-3">
            <p class="label-soft">Brief</p>
            <div class="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-gray-700">{{ c.brief }}</div>
          </div>
        </section>

        <!-- Le brouillon -->
        <section v-if="c.draft_key || c.draft_url" class="card-soft">
          <p class="label-soft">Brouillon{{ c.draft_at ? ` · reçu le ${day(c.draft_at)}` : '' }}</p>
          <video v-if="c.draft_key && isVideo(c.draft_key)" :src="media(c.draft_key)" controls class="mt-2 max-h-[480px] w-full rounded-xl bg-black"></video>
          <img v-else-if="c.draft_key" :src="media(c.draft_key)" alt="" class="mt-2 max-h-[480px] rounded-xl" />
          <p v-if="c.draft_key" class="mt-1 text-[13px]"><a :href="media(c.draft_key) + '&download=1'" class="text-green-dark underline">Télécharger</a></p>
          <p v-if="c.draft_url" class="mt-2 text-[14px]">Lien : <a :href="c.draft_url" target="_blank" rel="noopener" class="text-green-dark underline">{{ c.draft_url }}</a></p>
          <p v-if="c.draft_note" class="mt-2 rounded-lg bg-base-200 p-3 text-[14px]">Son mot : {{ c.draft_note }}</p>
          <div v-if="['draft_submitted', 'changes_requested', 'accepted'].includes(c.status)" class="mt-4 space-y-2">
            <textarea v-model="f.feedback" rows="3" placeholder="Ce qu'il faut retoucher (ira dans le fil et dans un mail à envoyer)" class="input-soft"></textarea>
            <div class="flex flex-wrap gap-2">
              <button class="btn-swapp px-4 py-2 text-[13px]" :disabled="!!busy" @click="act('approve', { note: f.note })">Valide, elle peut publier</button>
              <button class="btn-swapp-white px-4 py-2 text-[13px]" :disabled="!!busy || !f.feedback" @click="act('changes', { feedback: f.feedback })">Demande une retouche</button>
            </div>
          </div>
        </section>

        <!-- Publié, compteurs, paiement -->
        <section class="card-soft">
          <p class="label-soft">Suivi et paiement</p>
          <p v-if="c.published_url" class="mt-1 text-[14px]">Post : <a :href="c.published_url" target="_blank" rel="noopener" class="text-green-dark underline">{{ c.published_url }}</a></p>
          <div class="mt-3 flex flex-wrap items-end gap-2">
            <label class="text-[13px]">Inscrits via son lien<input v-model.number="f.signups" type="number" min="0" class="input-soft w-28" /></label>
            <label class="text-[13px]">Liste d'attente<input v-model.number="f.waitlist" type="number" min="0" class="input-soft w-28" /></label>
            <button class="btn-swapp-white px-4 py-2 text-[13px]" :disabled="!!busy" @click="act('counts', { signups: f.signups, waitlist: f.waitlist })">Mets à jour</button>
          </div>
          <p class="mt-3 text-[15px]">Vaut <b>{{ money(c.money.total, c.currency) }}</b> <span class="text-[13px] text-gray-500">({{ money(c.money.fixed, c.currency) }} fixe<span v-if="c.money.boost"> + {{ money(c.money.boost, c.currency) }} boost</span> + {{ money(c.money.variable, c.currency) }} variable{{ c.money.capped ? ', plafonné' : '' }})</span></p>
          <p v-if="c.invoice_key" class="mt-1 text-[14px]">Facture reçue le {{ day(c.invoice_at) }} : <a :href="media(c.invoice_key) + '&download=1'" class="text-green-dark underline">ouvrir</a></p>
          <div v-if="k" class="mt-2 rounded-lg bg-base-200 p-3 text-[14px]">
            <p class="label-soft">Virement</p>
            <p v-if="k.payout_details">{{ k.payout_name }} · {{ k.payout_details }}</p>
            <p v-else class="text-gray-500">Elle n'a pas encore saisi ses coordonnées bancaires.</p>
            <p class="mt-1 text-[12px] text-gray-500">Le virement se prépare dans Qonto et part avec ta validation. Puis « Payée » ici.</p>
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            <button class="btn-swapp-white px-4 py-2 text-[13px]" :disabled="!!busy" @click="act('statement')">Prépare le relevé (mail)</button>
            <button v-if="c.status !== 'paid'" class="btn-swapp px-4 py-2 text-[13px]" :disabled="!!busy" @click="act('paid', { amount: f.amount ?? c.money.total })">Payée {{ money(f.amount ?? c.money.total, c.currency) }}</button>
            <button v-if="!['paid', 'declined'].includes(c.status)" class="px-3 py-2 text-[13px] text-gray-500 underline" :disabled="!!busy" @click="act('decline')">Annule la collab</button>
            <button v-if="c.status === 'declined'" class="px-3 py-2 text-[13px] text-gray-500 underline" :disabled="!!busy" @click="act('reopen')">Rouvre</button>
          </div>
        </section>

        <!-- Le fil -->
        <section class="card-soft">
          <p class="label-soft">Fil avec {{ k?.name?.split(' ')[0] }}</p>
          <div class="mt-2 space-y-2">
            <div v-for="m in data.messages" :key="m.id" class="rounded-xl px-3 py-2 text-[14px]" :class="m.author === 'andswapp' ? 'ml-8 bg-green-light/30' : 'mr-8 bg-base-200'">
              <p class="whitespace-pre-wrap">{{ m.body }}</p>
              <p class="mt-1 text-[11px] text-gray-500">{{ m.author === 'andswapp' ? 'Toi' : k?.name }} · {{ day(m.ts) }}</p>
            </div>
            <p v-if="!data.messages?.length" class="text-[13px] text-gray-400">Rien encore.</p>
          </div>
          <textarea v-model="f.message" rows="2" placeholder="Écris-lui" class="input-soft mt-2"></textarea>
          <div class="mt-2 flex flex-wrap items-center gap-3">
            <button class="btn-swapp px-4 py-2 text-[13px]" :disabled="!!busy || !f.message" @click="sendMessage">Poste dans le fil</button>
            <label class="flex items-center gap-1 text-[13px] text-gray-600"><input v-model="f.notify" type="checkbox" class="checkbox checkbox-xs" /> et prépare un mail</label>
          </div>
        </section>
      </div>

      <aside class="space-y-6">
        <section class="card-soft">
          <p class="label-soft">Son espace</p>
          <p class="mt-1 break-all text-[13px]"><a :href="data.link" target="_blank" rel="noopener" class="text-green-dark underline">{{ data.link }}</a></p>
          <p class="mt-2 text-[13px] text-gray-500">{{ k?.email }}<span v-if="k?.city"> · {{ k.city }}</span><span v-if="k?.code"> · ?c={{ k.code }}</span><span v-if="k?.last_seen"> · vue le {{ day(k.last_seen) }}</span></p>
          <p v-if="k?.notes" class="mt-2 whitespace-pre-wrap text-[13px] text-gray-600">{{ k.notes }}</p>
        </section>
        <section class="card-soft">
          <p class="label-soft">Mails de cette collab</p>
          <div v-for="m in data.outbox" :key="m.id" class="mt-2 border-t border-gray-100 pt-2 text-[13px]">
            <p><span class="pill" :class="m.status === 'held' ? 'bg-yellow/40 text-green-dark' : m.status === 'sent' ? 'bg-gray-200 text-gray-700' : 'bg-orange-100 text-orange-800'">{{ m.status === 'held' ? 'à envoyer' : m.status === 'sent' ? 'parti' : m.status }}</span> {{ m.subject }}</p>
            <p class="text-[12px] text-gray-500">{{ day(m.sent_at || m.created_at) }}</p>
            <button v-if="m.status === 'held'" class="mt-1 btn-swapp px-3 py-1 text-[12px]" :disabled="!!busy" @click="sendMail(m)">Envoie</button>
          </div>
          <p v-if="!data.outbox?.length" class="mt-1 text-[13px] text-gray-400">Aucun.</p>
          <p class="mt-2 text-[12px] text-gray-500">Pour relire ou corriger un mail avant envoi : <NuxtLink to="/admin" class="underline">la file</NuxtLink>.</p>
        </section>
      </aside>
    </main>
  </div>
</template>
