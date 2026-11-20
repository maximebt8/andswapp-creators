import { money } from '../../../shared/utils/collab'
import { addDays, daysUntil, nice, niceFr, postWindow, toDay } from '../../../shared/utils/dates'

// Le tour des rappels, une fois par jour (workflow « rappels ») ou sur « Fais le tour » dans le tableau de bord.
// Il relit chaque collab et, quand quelque chose traîne, écrit la relance dans la file (rien ne part sans le clic
// de max) et le note pour max. À la fin, un seul mail à max : ce qui a été préparé, ce qui l'attend.
// Le tour automatique ne tourne que si le réglage « reminders » est sur on ; « Fais le tour » passe outre.
const DAYS = 86400000
const REPEAT_AFTER = 7 // jours avant de relancer une créatrice sur le même sujet

type Found = { creator: string; what: string; collab?: number }

export default defineEventHandler(async (event) => {
  const env = requireAdmin(event)
  const body = await readJson(event).catch(() => ({}))
  const forced = body.force === true
  if (!forced && (await getSetting(env.DB, 'reminders')) !== 'on') return { skipped: 'off', held: [], alerts: [] }

  const today = toDay(new Date())
  const nowMs = Date.now()
  const ageDays = (iso: string | null | undefined) => (iso ? (nowMs - new Date(iso).getTime()) / DAYS : null)
  const [creators, collabs, recent, changes] = await Promise.all([
    env.DB.prepare('SELECT * FROM creators').all<CreatorRow>(),
    env.DB.prepare("SELECT * FROM collabs WHERE status NOT IN ('paid', 'declined')").all<CollabRow>(),
    env.DB.prepare('SELECT kind, creator_id, collab_id, status, created_at FROM outbox WHERE created_at > ?1').bind(new Date(nowMs - REPEAT_AFTER * DAYS).toISOString()).all<{ kind: string; creator_id: number | null; collab_id: number | null; status: string; created_at: string }>(),
    env.DB.prepare("SELECT collab_id, max(ts) AS ts FROM events WHERE name = 'changes_requested' GROUP BY collab_id").all<{ collab_id: number; ts: string }>(),
  ])
  const byId = new Map((creators.results ?? []).map((c) => [c.id, c]))
  const changedAt = new Map((changes.results ?? []).map((r) => [r.collab_id, r.ts]))
  const alreadySent = (kind: string, creator: number, collab?: number | null) => (recent.results ?? []).some((m) => m.kind === kind && m.creator_id === creator && (collab ? m.collab_id === collab : true))
  const everSent = async (kinds: string[], creator: number) => {
    const row = await env.DB.prepare(`SELECT id FROM outbox WHERE creator_id = ?1 AND status = 'sent' AND kind IN (${kinds.map(() => '?').join(',')}) LIMIT 1`).bind(creator, ...kinds).first()
    return !!row
  }

  const held: Found[] = []
  const alerts: Found[] = []
  const remind = async (creator: CreatorRow, collab: CollabRow | null, kind: string, subject: string, lines: string[]) => {
    if (alreadySent(kind, creator.id, collab?.id)) return
    const link = await creatorLink(env, creator)
    await hold(env.DB, { to: creator.email, subject, body: [`Hi ${creator.name.split(' ')[0]},`, '', ...lines, '', link, '', 'Max'].join('\n'), kind, creator: creator.id, collab: collab?.id ?? null })
    held.push({ creator: creator.name, what: subject, collab: collab?.id })
  }
  const alert = (creator: CreatorRow, what: string, collab?: CollabRow) => alerts.push({ creator: creator.name, what, collab: collab?.id })

  // 1. Invitée, le mail d'accès parti, jamais venue en 48 h.
  for (const creator of creators.results ?? []) {
    if (creator.status !== 'invited' || creator.last_seen || (ageDays(creator.created_at) ?? 0) < 2) continue
    if (!(await everSent(['invite', 'link', 'offer'], creator.id))) continue
    await remind(creator, null, 'reminder_space', 'Your &Swapp space is waiting for you', ['Just checking you got your personal link. Your offer and brief are in your space, one click to open it:'])
    alert(creator, "n'a pas ouvert son espace depuis l'invitation")
  }

  for (const c of collabs.results ?? []) {
    const creator = byId.get(c.creator_id)
    if (!creator) continue
    const first = creator.name.split(' ')[0]
    const stage = `« ${c.title} »`

    if (c.status === 'offered' && (ageDays(c.offered_at) ?? 0) >= 3) {
      await remind(creator, c, 'reminder_offer', `Your &Swapp offer is still open: ${c.title}`, [`Your offer for ${c.deliverables ?? 'the content'} is waiting in your space. One click to accept and the brief unlocks right away.`, 'Not the right time? Just tell me, no hard feelings.'])
      alert(creator, `offre ${stage} sans réponse depuis ${Math.floor(ageDays(c.offered_at) ?? 0)} j`, c)
    }

    if (c.status === 'accepted' || c.status === 'changes_requested') {
      const since = c.status === 'changes_requested' ? changedAt.get(c.id) ?? c.accepted_at : c.accepted_at
      const version = c.status === 'changes_requested' ? 'the new version' : 'your draft'
      const until = daysUntil(c.draft_due, today)
      if (c.draft_due && until !== null && until < 0) {
        await remind(creator, c, 'reminder_draft_late', `Your draft for ${c.title}`, [`${version[0]!.toUpperCase() + version.slice(1)} was due on ${nice(c.draft_due)}. Is everything OK on your side? You can drop it in your space, or tell me a new date and we'll adjust the plan.`])
        alert(creator, `brouillon ${stage} attendu le ${niceFr(c.draft_due)}, toujours rien`, c)
      } else if (c.draft_due && until !== null && until <= 2) {
        await remind(creator, c, 'reminder_draft', `${until === 0 ? 'Today' : `${nice(c.draft_due)}`}: ${version} for ${c.title}`, [`Quick reminder: ${version} is due ${until === 0 ? 'today' : `on ${nice(c.draft_due)}`}. You can upload a video, images or a link straight from your space:`])
      } else if (!c.draft_due && (ageDays(since) ?? 0) >= 3) {
        await remind(creator, c, 'reminder_draft', `How is ${version} going? ${c.title}`, [`No rush, just checking in. When ${version} is ready, drop it in your space and I'll review it within 48 hours:`])
      }
    }

    if (c.status === 'draft_submitted' && (ageDays(c.draft_at) ?? 0) >= 2) alert(creator, `brouillon ${stage} reçu le ${niceFr(c.draft_at)}, tu as promis une réponse en 48 h`, c)

    if (c.status === 'approved') {
      const over = daysUntil(c.deadline, today)
      const from = daysUntil(c.post_from, today)
      if (c.deadline && over !== null && over < 0) {
        await remind(creator, c, 'reminder_post_late', `Your post for ${c.title}`, [`Your draft is approved and the window to post closed on ${nice(c.deadline)}. Post when you can and paste the link in your space, or tell me what works for you:`])
        alert(creator, `validée, fenêtre de publication ${stage} passée (${niceFr(c.deadline)}), pas de lien`, c)
      } else if ((c.post_from && from !== null && from <= 0) || (!c.post_from && (ageDays(c.approved_at) ?? 0) >= 3)) {
        const window = postWindow(c.post_from, c.deadline)
        await remind(creator, c, 'reminder_post', `Ready to post: ${c.title}`, [`Your draft is approved.${window ? ` You can post ${window}.` : ''} Once it's live, paste the link in your space so your sign-ups are tracked from day one:`])
        if (c.deadline && over !== null && over <= 2) alert(creator, `validée, à publier ${stage} avant le ${niceFr(c.deadline)}, pas encore de lien`, c)
      }
    }

    if (c.status === 'published' && c.published_at) {
      const live = ageDays(c.published_at) ?? 0
      let stats: unknown[] = []
      try { stats = JSON.parse(c.stats_keys ?? '[]') } catch { stats = [] }
      if (live >= 7 && !stats.length) {
        await remind(creator, c, 'reminder_stats', `Your 7-day stats for ${c.title}`, ['One week in, could you drop a screenshot of your insights (views, link clicks) in your space? It really helps me show what your content did:'])
        alert(creator, `publiée ${stage} depuis ${Math.floor(live)} j, pas de capture de stats`, c)
      }
      if (!c.counts_at || (ageDays(c.counts_at) ?? 0) >= 7) alert(creator, `inscrits ${stage} ${c.counts_at ? `pas mis à jour depuis le ${niceFr(c.counts_at)}` : 'jamais mis à jour'} (compteur à ${c.signups})`, c)
      if (live >= 30 && !c.invoice_key) {
        await remind(creator, c, 'reminder_invoice', `You can send your invoice: ${c.title}`, [`Your 30-day window closed on ${nice(addDays(c.published_at.slice(0, 10), 30))}. Your statement is in Payments: upload your invoice there and the transfer will go out within 5 working days.`])
        alert(creator, `30 jours passés ${stage}, pas de facture`, c)
      }
    }

    if (c.status === 'invoiced' && (ageDays(c.invoice_at) ?? 0) >= 7) alert(creator, `facture ${stage} reçue le ${niceFr(c.invoice_at)}, ${money(c.fixed_amount, c.currency)} et plus à virer (promis sous 5 jours ouvrés)`, c)
  }

  const summary = { held: held.length, alerts: alerts.length, forced }
  await logEvent(env.DB, 'tick', {}, summary)
  if (held.length || alerts.length) {
    const lines = [`Tour du ${niceFr(today)}.`, '']
    if (held.length) lines.push(`${held.length} relance${held.length > 1 ? 's' : ''} prête${held.length > 1 ? 's' : ''} dans la file, à envoyer d'un clic :`, ...held.map((h) => `· ${h.creator} : ${h.what}`), '')
    if (alerts.length) lines.push('Ça t\'attend :', ...alerts.map((a) => `· ${a.creator} ${a.what}`), '')
    lines.push(`${env.SITE_URL ?? ''}/admin`)
    await tellMax(env, `Créatrices : ${held.length} relance${held.length > 1 ? 's' : ''}, ${alerts.length} point${alerts.length > 1 ? 's' : ''} à voir`, lines)
  }
  return { ...summary, held, alerts, today }
})
