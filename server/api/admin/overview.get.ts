import { payout } from '../../../shared/utils/collab'

// Le tableau de bord : toutes les créatrices, toutes les collabs avec ce qu'elles valent, les mails en attente, le kit,
// les réglages et le dernier tour des rappels.
export default defineEventHandler(async (event) => {
  const env = requireAdmin(event)
  const [creators, collabs, outbox, kit, settings, lastTick] = await Promise.all([
    env.DB.prepare('SELECT id, name, handle, email, city, lang, code, status, invoice_mode, notes, created_at, last_seen, payout_name, (payout_details IS NOT NULL) AS has_payout, link_token FROM creators ORDER BY id DESC').all<any>(),
    env.DB.prepare('SELECT * FROM collabs ORDER BY id DESC').all<CollabRow>(),
    env.DB.prepare("SELECT o.*, c.name AS creator_name FROM outbox o LEFT JOIN creators c ON c.id = o.creator_id WHERE o.status = 'held' ORDER BY o.id DESC").all<any>(),
    env.DB.prepare('SELECT * FROM kit_files WHERE hidden = 0 ORDER BY id DESC').all<KitRow>(),
    allSettings(env.DB),
    env.DB.prepare("SELECT ts, props FROM events WHERE name = 'tick' ORDER BY id DESC LIMIT 1").first<{ ts: string; props: string | null }>(),
  ])
  const links: Record<number, string> = {}
  for (const creator of creators.results ?? []) links[creator.id] = await creatorLink(env, creator)
  const rows = (collabs.results ?? []).map((row) => ({ ...row, money: payout(row) }))
  const due = rows.filter((c) => ['published', 'invoiced'].includes(c.status)).reduce((sum, c) => sum + c.money.total, 0)
  const paid = rows.filter((c) => c.status === 'paid').reduce((sum, c) => sum + (c.paid_amount ?? c.money.total), 0)
  const signups = rows.reduce((sum, c) => sum + c.signups, 0)
  return {
    creators: creators.results ?? [],
    collabs: rows,
    outbox: outbox.results ?? [],
    kit: (kit.results ?? []).map((f) => ({ ...f, size_text: sizeText(f.size) })),
    settings,
    lastTick: lastTick ? { at: lastTick.ts, ...(lastTick.props ? JSON.parse(lastTick.props) : {}) } : null,
    mail: !!env.BREVO_API_KEY,
    links,
    totals: { due: Math.round(due * 100) / 100, paid: Math.round(paid * 100) / 100, signups, costPerSignup: signups ? Math.round(((due + paid) / signups) * 100) / 100 : null },
  }
})
