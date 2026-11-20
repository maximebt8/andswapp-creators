<script setup>
// Le tableau de bord &Swapp : ce qui attend un geste, la file des mails, les rappels, le kit, les créatrices, les
// collabs, les totaux. Clé dans l'adresse une fois (/admin?k=), puis cookie.
import { money, STATUSES } from '~~/shared/utils/collab'

useHead({ title: 'Créateurs · tableau de bord' })
// La première visite porte la clé dans l'adresse (?k=) : on la passe à l'API, le cookie prend le relais ensuite.
const route = useRoute()
const { data, error, refresh } = await useFetch('/api/admin/overview', { key: 'overview', query: { k: route.query.k } })
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

const creators = computed(() => data.value?.creators ?? [])
const collabs = computed(() => data.value?.collabs ?? [])
const outbox = computed(() => data.value?.outbox ?? [])
const kit = computed(() => (data.value?.kit ?? []).filter((f) => !f.collab_id))
const totals = computed(() => data.value?.totals ?? {})
const mail = computed(() => !!data.value?.mail)
const reminders = computed(() => data.value?.settings?.reminders === 'on')
const creatorOf = (id) => creators.value.find((c) => c.id === id)
const waiting = computed(() => collabs.value.filter((c) => ['draft_submitted', 'invoiced'].includes(c.status)))
const pipeline = computed(() => STATUSES.map((s) => ({ s, n: collabs.value.filter((c) => c.status === s).length })).filter((x) => x.n))

// Nouvelle créatrice
const nc = reactive({ open: false, name: '', handle: '', email: '', city: 'London', lang: 'en', code: '', notes: '' })
const createCreator = () =>
  run('creator', async () => {
    await $fetch('/api/admin/creator', { method: 'POST', body: nc })
    Object.assign(nc, { open: false, name: '', handle: '', email: '', code: '', notes: '' })
  })

// Nouvelle collab (l'offre) : montants, dates, messages clés, légende, brief.
const no = reactive({ open: false, creator_id: '', title: '', currency: 'GBP', fixed_amount: 175, boost_pct: 0, per_signup: 15, per_waitlist: 5, cap_variable: 150, deliverables: '1 Reel + 3 Stories', draft_due: '', post_from: '', deadline: '', key_messages: '', caption: '', brief: '' })
const offer = (creatorId) => {
  no.creator_id = creatorId
  no.title = `Reel + Stories · ${creatorOf(creatorId)?.name ?? ''}`
  no.open = true
}
const createCollab = () =>
  run('collab', async () => {
    await $fetch('/api/admin/collab', { method: 'POST', body: no })
    no.open = false
  })

// La file
const editing = ref(null)
const sendMail = (m) => run(`send-${m.id}`, () => $fetch('/api/admin/outbox', { method: 'POST', body: { id: m.id, action: 'send' } }))
const outlookMail = (m) => run(`outlook-${m.id}`, () => $fetch('/api/admin/outbox', { method: 'POST', body: { id: m.id, action: 'outlook' } }))
const dropMail = (m) => run(`drop-${m.id}`, () => $fetch('/api/admin/outbox', { method: 'POST', body: { id: m.id, action: 'drop' } }))
const saveMail = (m) => run(`edit-${m.id}`, async () => {
  await $fetch('/api/admin/outbox', { method: 'POST', body: { id: m.id, action: 'edit', subject: m.subject, body: m.body } })
  editing.value = null
})
const copy = (textToCopy) => navigator.clipboard?.writeText(textToCopy)

// Les rappels : l'interrupteur du tour automatique, et « Fais le tour » tout de suite.
const tour = ref(null)
const setReminders = (on) => run('reminders', () => $fetch('/api/admin/settings', { method: 'POST', body: { key: 'reminders', value: on ? 'on' : 'off' } }))
const runTour = () => run('tour', async () => { tour.value = await $fetch('/api/admin/tick', { method: 'POST', body: { force: true } }) })

// Le kit commun : un ou plusieurs fichiers d'un coup.
const addKit = (files, collab = null) =>
  run('kit', async () => {
    for (const file of files) await $fetch(`/api/admin/kit?${new URLSearchParams({ name: file.name, collab: collab ?? '' })}`, { method: 'PUT', body: file, headers: { 'content-type': file.type || 'application/octet-stream' } })
  })
const hideKit = (f) => run(`kit-${f.id}`, () => $fetch('/api/admin/kit', { method: 'POST', body: { id: f.id, hidden: true } }))

const day = (iso) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '')
const when = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '')
</script>

<template>
  <div class="min-h-dvh bg-base-200">
    <SwappHeader subtitle="Créateurs · tableau de bord" to="/admin" />
    <main v-if="error" class="mx-auto max-w-3xl px-5 py-10">
      <h1 class="text-xl font-bold text-green-dark">Il faut la clé</h1>
      <p class="mt-2 text-[15px] text-gray-600">Ouvre /admin?k=… avec la clé du tableau de bord. Elle reste ensuite dans un cookie.</p>
    </main>
    <main v-else class="mx-auto max-w-5xl space-y-6 px-5 pb-20 md:px-8">
      <p v-if="msg" class="rounded-xl bg-orange-50 px-4 py-2 text-[14px] text-orange-900">{{ msg }}</p>

      <!-- Totaux -->
      <section class="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div class="card-soft"><p class="label-soft">À payer</p><p class="text-2xl font-extrabold text-green-dark">{{ money(totals.due ?? 0) }}</p></div>
        <div class="card-soft"><p class="label-soft">Déjà payé</p><p class="text-2xl font-extrabold text-green-dark">{{ money(totals.paid ?? 0) }}</p></div>
        <div class="card-soft"><p class="label-soft">Inscrits via créatrices</p><p class="text-2xl font-extrabold text-green-dark">{{ totals.signups ?? 0 }}</p></div>
        <div class="card-soft"><p class="label-soft">Coût par inscrit</p><p class="text-2xl font-extrabold text-green-dark">{{ totals.costPerSignup != null ? money(totals.costPerSignup) : '–' }}</p></div>
      </section>

      <!-- Ce qui t'attend -->
      <section v-if="waiting.length || outbox.length" class="card-soft border-yellow bg-yellow/10">
        <p class="label-soft">Ça t'attend</p>
        <ul class="mt-2 space-y-1 text-[15px]">
          <li v-for="c in waiting" :key="c.id">
            <NuxtLink :to="`/admin/collab/${c.id}`" class="font-semibold text-green-dark underline">{{ creatorOf(c.creator_id)?.name }}</NuxtLink>
            : {{ c.status === 'draft_submitted' ? 'brouillon à relire' : `facture reçue, ${money(c.money.total, c.currency)} à virer` }}
          </li>
          <li v-if="outbox.length">{{ outbox.length }} mail{{ outbox.length > 1 ? 's' : '' }} en attente de ton geste (ci-dessous).</li>
        </ul>
      </section>

      <!-- La file des mails -->
      <section class="card-soft">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-bold text-green-dark">Mails à envoyer</h2>
          <span class="text-[13px] text-gray-500">Rien ne part sans ton clic.</span>
        </div>
        <p v-if="!mail" class="mt-2 rounded-lg bg-base-200 px-3 py-2 text-[13px] text-gray-600">Pas de clé Brevo sur le site : « Copie le texte », colle-le dans Outlook, puis « Parti d'Outlook » pour que la file et les rappels le sachent.</p>
        <p v-if="!outbox.length" class="mt-2 text-[14px] text-gray-500">La file est vide.</p>
        <div v-for="m in outbox" :key="m.id" class="mt-3 rounded-xl border border-gray-200 p-3">
          <div class="flex flex-wrap items-center gap-2 text-[13px] text-gray-500">
            <span class="pill bg-base-200 text-gray-700">{{ m.kind.replace('reminder_', 'relance ') }}</span>
            <span>à <b>{{ m.creator_name || m.to_email }}</b> ({{ m.to_email }})</span>
            <span>· {{ day(m.created_at) }}</span>
          </div>
          <template v-if="editing === m.id">
            <input v-model="m.subject" class="input-soft mt-2" />
            <textarea v-model="m.body" rows="8" class="input-soft mt-2 font-mono text-[13px]"></textarea>
            <div class="mt-2 flex gap-2">
              <button class="btn-swapp px-4 py-2 text-[13px]" :disabled="!!busy" @click="saveMail(m)">Garder</button>
              <button class="btn-swapp-white px-4 py-2 text-[13px]" @click="editing = null; refresh()">Annuler</button>
            </div>
          </template>
          <template v-else>
            <p class="mt-1 font-semibold text-gray-800">{{ m.subject }}</p>
            <pre class="mt-1 whitespace-pre-wrap font-sans text-[14px] text-gray-700">{{ m.body }}</pre>
            <div class="mt-2 flex flex-wrap gap-2">
              <button v-if="mail" class="btn-swapp px-4 py-2 text-[13px]" :disabled="!!busy" @click="sendMail(m)">{{ busy === `send-${m.id}` ? 'Envoi…' : 'Envoie' }}</button>
              <button :class="mail ? 'btn-swapp-white' : 'btn-swapp'" class="px-4 py-2 text-[13px]" @click="copy(`${m.subject}\n\n${m.body}`)">Copie le texte</button>
              <button class="btn-swapp-white px-4 py-2 text-[13px]" :disabled="!!busy" @click="outlookMail(m)">Parti d'Outlook</button>
              <button class="btn-swapp-white px-4 py-2 text-[13px]" @click="editing = m.id">Corrige</button>
              <button class="btn-swapp-white px-4 py-2 text-[13px] text-gray-500" :disabled="!!busy" @click="dropMail(m)">Jette</button>
            </div>
          </template>
        </div>
      </section>

      <!-- Les rappels -->
      <section class="card-soft">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-lg font-bold text-green-dark">Rappels</h2>
          <button class="btn-swapp-white px-4 py-2 text-[13px]" :disabled="!!busy" @click="runTour">{{ busy === 'tour' ? 'Tour en cours…' : 'Fais le tour maintenant' }}</button>
        </div>
        <p class="mt-1 text-[13px] text-gray-600">Le tour relit chaque collab : offre sans réponse, brouillon en retard, post à publier, stats et facture qui tardent. Les relances s'écrivent dans la file (rien ne part sans toi) et tu reçois le résumé par mail.</p>
        <label class="mt-3 flex cursor-pointer items-center gap-3 text-[14px]">
          <input type="checkbox" class="toggle toggle-sm" :checked="reminders" :disabled="!!busy" @change="setReminders($event.target.checked)" />
          <span><b>Tour automatique chaque matin vers 8 h</b> <span class="text-gray-500">({{ reminders ? 'allumé' : 'éteint : rien ne tourne tout seul' }})</span></span>
        </label>
        <p v-if="data.lastTick" class="mt-2 text-[12px] text-gray-500">Dernier tour : {{ when(data.lastTick.at) }}, {{ data.lastTick.held ?? 0 }} relance{{ (data.lastTick.held ?? 0) > 1 ? 's' : '' }}, {{ data.lastTick.alerts ?? 0 }} point{{ (data.lastTick.alerts ?? 0) > 1 ? 's' : '' }} à voir.</p>
        <div v-if="tour" class="mt-3 rounded-xl bg-base-200 p-3 text-[14px]">
          <p v-if="!tour.held.length && !tour.alerts.length">Rien ne traîne aujourd'hui.</p>
          <template v-else>
            <p v-if="tour.held.length" class="font-semibold">{{ tour.held.length }} relance{{ tour.held.length > 1 ? 's' : '' }} dans la file :</p>
            <ul class="list-disc pl-5"><li v-for="(h, i) in tour.held" :key="i">{{ h.creator }} : {{ h.what }}</li></ul>
            <p v-if="tour.alerts.length" class="mt-2 font-semibold">À voir :</p>
            <ul class="list-disc pl-5"><li v-for="(a, i) in tour.alerts" :key="i">{{ a.creator }} {{ a.what }}</li></ul>
          </template>
        </div>
      </section>

      <!-- Collabs -->
      <section class="card-soft">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-lg font-bold text-green-dark">Collabs</h2>
          <div class="flex flex-wrap gap-1">
            <StatusPill v-for="p in pipeline" :key="p.s" :status="p.s" lang="fr" :title="p.n" />
          </div>
        </div>
        <table class="mt-3 w-full text-[14px]">
          <thead class="text-left text-[12px] uppercase tracking-wide text-gray-500">
            <tr><th class="py-1">Créatrice</th><th>Collab</th><th>Statut</th><th class="hidden sm:table-cell">Dates</th><th class="text-right">Inscrits</th><th class="text-right">Vaut</th></tr>
          </thead>
          <tbody>
            <tr v-for="c in collabs" :key="c.id" class="border-t border-gray-100">
              <td class="py-2 font-semibold">{{ creatorOf(c.creator_id)?.name }}</td>
              <td><NuxtLink :to="`/admin/collab/${c.id}`" class="text-green-dark underline">{{ c.title }}</NuxtLink></td>
              <td><StatusPill :status="c.status" lang="fr" /></td>
              <td class="hidden text-[12px] text-gray-500 sm:table-cell"><span v-if="c.draft_due">brouillon {{ day(c.draft_due) }}</span><span v-if="c.deadline"> · post {{ c.post_from ? `${day(c.post_from)} au ` : 'avant le ' }}{{ day(c.deadline) }}</span></td>
              <td class="text-right">{{ c.signups }}<span v-if="c.waitlist" class="text-gray-400"> +{{ c.waitlist }}</span></td>
              <td class="text-right font-semibold">{{ money(c.money.total, c.currency) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="!collabs.length" class="mt-2 text-[14px] text-gray-500">Aucune collab. Crée une créatrice, puis « Nouvelle offre ».</p>
      </section>

      <!-- Le kit commun -->
      <section class="card-soft">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-lg font-bold text-green-dark">Kit pour toutes</h2>
          <label class="btn-swapp cursor-pointer px-4 py-2 text-[13px]">{{ busy === 'kit' ? 'Dépôt…' : 'Ajoute des fichiers' }}<input type="file" multiple class="hidden" @change="$event.target.files.length && addKit([...$event.target.files])" /></label>
        </div>
        <p class="mt-1 text-[13px] text-gray-600">Logo, visuels, captures d'app : chaque créatrice les télécharge depuis sa page de campagne. 100 Mo par fichier. Pour un fichier réservé à une collab, passe par sa page.</p>
        <ul v-if="kit.length" class="mt-3 divide-y divide-gray-100">
          <li v-for="f in kit" :key="f.id" class="flex items-center gap-3 py-2 text-[14px]">
            <a :href="`/api/media?key=${encodeURIComponent(f.key)}&download=1`" class="min-w-0 flex-1 truncate font-semibold text-green-dark underline">{{ f.name }}</a>
            <span class="text-[12px] text-gray-500">{{ f.size_text }} · {{ day(f.created_at) }}</span>
            <button class="text-[13px] text-gray-500 underline" :disabled="!!busy" @click="hideKit(f)">Retire</button>
          </li>
        </ul>
        <p v-else class="mt-2 text-[14px] text-gray-500">Rien pour l'instant : les créatrices voient « Logo, visuals and app screenshots will appear here as soon as Max adds them ».</p>
      </section>

      <!-- Créatrices -->
      <section class="card-soft">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-bold text-green-dark">Créatrices</h2>
          <button class="btn-swapp px-4 py-2 text-[13px]" @click="nc.open = !nc.open">Nouvelle créatrice</button>
        </div>
        <form v-if="nc.open" class="mt-3 grid gap-2 rounded-xl bg-base-200 p-3 md:grid-cols-2" @submit.prevent="createCreator">
          <input v-model="nc.name" required placeholder="Prénom Nom" class="input-soft" />
          <input v-model="nc.handle" placeholder="@instagram" class="input-soft" />
          <input v-model="nc.email" type="email" required placeholder="email" class="input-soft" />
          <input v-model="nc.city" placeholder="Ville" class="input-soft" />
          <input v-model="nc.code" placeholder="code du lien perso (ex. clio)" class="input-soft" />
          <select v-model="nc.lang" class="input-soft"><option value="en">en</option><option value="fr">fr</option></select>
          <textarea v-model="nc.notes" rows="2" placeholder="Notes internes" class="input-soft md:col-span-2"></textarea>
          <div class="md:col-span-2"><button type="submit" class="btn-swapp px-5 py-2 text-[14px]" :disabled="!!busy">Créer et préparer l'invitation</button></div>
        </form>
        <div v-for="k in creators" :key="k.id" class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-100 pt-3 text-[14px]">
          <div class="min-w-40">
            <p class="font-semibold">{{ k.name }} <span v-if="k.handle" class="font-normal text-gray-500">@{{ k.handle }}</span></p>
            <p class="text-[12px] text-gray-500">{{ k.email }} · {{ k.city }} · {{ k.status }} · {{ k.last_seen ? `vue le ${when(k.last_seen)}` : 'jamais venue' }}<span v-if="k.has_payout"> · RIB ok</span></p>
          </div>
          <span v-if="k.code" class="pill bg-base-200 text-gray-700">utm_source={{ k.code }}</span>
          <button class="text-[13px] text-green-dark underline" @click="copy(data.links[k.id])">Copier son lien</button>
          <button class="text-[13px] text-green-dark underline" @click="offer(k.id)">Nouvelle offre</button>
        </div>
        <form v-if="no.open" class="mt-4 grid gap-2 rounded-xl bg-base-200 p-3 md:grid-cols-3" @submit.prevent="createCollab">
          <p class="text-[14px] font-semibold md:col-span-3">Offre pour {{ creatorOf(no.creator_id)?.name }}</p>
          <input v-model="no.title" required placeholder="Titre" class="input-soft md:col-span-2" />
          <select v-model="no.currency" class="input-soft"><option>GBP</option><option>EUR</option><option>USD</option></select>
          <label class="text-[13px]">Fixe<input v-model.number="no.fixed_amount" type="number" min="0" class="input-soft" /></label>
          <label class="text-[13px]">Boost pub %<input v-model.number="no.boost_pct" type="number" min="0" class="input-soft" /></label>
          <label class="text-[13px]">Par inscrit<input v-model.number="no.per_signup" type="number" min="0" step="0.5" class="input-soft" /></label>
          <label class="text-[13px]">Par liste d'attente<input v-model.number="no.per_waitlist" type="number" min="0" step="0.5" class="input-soft" /></label>
          <label class="text-[13px]">Plafond variable<input v-model.number="no.cap_variable" type="number" min="0" class="input-soft" /></label>
          <input v-model="no.deliverables" placeholder="Livrables (1 Reel + 3 Stories)" class="input-soft self-end" />
          <label class="text-[13px]">Brouillon pour le<input v-model="no.draft_due" type="date" class="input-soft" /></label>
          <label class="text-[13px]">Publier à partir du<input v-model="no.post_from" type="date" class="input-soft" /></label>
          <label class="text-[13px]">Publier jusqu'au<input v-model="no.deadline" type="date" class="input-soft" /></label>
          <textarea v-model="no.key_messages" rows="3" placeholder="3 messages clés, un par ligne (elle les voit numérotés en tête du brief)" class="input-soft md:col-span-3"></textarea>
          <textarea v-model="no.caption" rows="4" placeholder="Légende modèle, qu'elle copie et adapte (optionnel)" class="input-soft md:col-span-3"></textarea>
          <textarea v-model="no.brief" rows="8" placeholder="Le brief, tel qu'elle le lira. TITRES EN CAPITALES, listes avec « - »." class="input-soft md:col-span-3"></textarea>
          <div class="flex gap-2 md:col-span-3">
            <button type="submit" class="btn-swapp px-5 py-2 text-[14px]" :disabled="!!busy">Créer l'offre et préparer le mail</button>
            <button type="button" class="btn-swapp-white px-5 py-2 text-[14px]" @click="no.open = false">Annuler</button>
          </div>
        </form>
      </section>
    </main>
  </div>
</template>
