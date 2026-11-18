import { payout } from '../../shared/utils/collab'

export type CollabRow = {
  id: number; creator_id: number; title: string; status: string; currency: string; fixed_amount: number; boost_pct: number; per_signup: number; per_waitlist: number; cap_variable: number
  deliverables: string | null; brief: string | null; deadline: string | null; offered_at: string; accepted_at: string | null; draft_key: string | null; draft_url: string | null; draft_note: string | null; draft_at: string | null
  feedback: string | null; approved_at: string | null; published_url: string | null; published_at: string | null; signups: number; waitlist: number; invoice_key: string | null; invoice_at: string | null; paid_at: string | null; paid_amount: number | null; created_at: string
}
export type MessageRow = { id: number; collab_id: number; author: string; body: string; ts: string }

export async function collabsOf(db: D1Database, creatorId: number) {
  const { results } = await db.prepare('SELECT * FROM collabs WHERE creator_id = ?1 ORDER BY id DESC').bind(creatorId).all<CollabRow>()
  return (results ?? []).map((row) => ({ ...row, money: payout(row) }))
}

export async function messagesOf(db: D1Database, collabIds: number[]) {
  if (!collabIds.length) return [] as MessageRow[]
  const { results } = await db.prepare(`SELECT * FROM messages WHERE collab_id IN (${collabIds.map(() => '?').join(',')}) ORDER BY id ASC`).bind(...collabIds).all<MessageRow>()
  return results ?? []
}

// Une collab qui appartient bien à cette créatrice, sinon 404.
export async function ownCollab(db: D1Database, creatorId: number, collabId: number) {
  const row = await db.prepare('SELECT * FROM collabs WHERE id = ?1 AND creator_id = ?2').bind(collabId, creatorId).first<CollabRow>()
  if (!row) throw createError({ statusCode: 404, statusMessage: 'no such collab' })
  return row
}

export const int = (value: unknown, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback)
export const text = (value: unknown, max = 4000) => (typeof value === 'string' ? value.trim().slice(0, max) : '')
export const isoDay = (value: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? '')) ? String(value) : null)
