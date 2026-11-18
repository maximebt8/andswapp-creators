import type { H3Event } from 'h3'

// Sur Cloudflare Pages (et wrangler pages dev), Nitro expose les bindings (D1, R2, secrets) ici.
export type CloudflareEnv = { DB: D1Database; MEDIA: R2Bucket; ADMIN_KEY?: string; BREVO_API_KEY?: string; MAX_EMAIL?: string; SITE_URL?: string }
type CloudflareContext = { env: CloudflareEnv; context: { waitUntil(promise: Promise<unknown>): void } }

export function cloudflare(event: H3Event): CloudflareContext {
  return event.context.cloudflare as CloudflareContext
}

// Le tableau de bord &Swapp : la clé arrive dans l'adresse (?k=) une fois, puis vit dans un cookie.
export const ADMIN_COOKIE = 'creators_admin'
export function hasAdminKey(event: H3Event): boolean {
  const { env } = cloudflare(event)
  return !!env.ADMIN_KEY && (getQuery(event).k === env.ADMIN_KEY || getCookie(event, ADMIN_COOKIE) === env.ADMIN_KEY || getHeader(event, 'x-admin-key') === env.ADMIN_KEY)
}

export function requireAdmin(event: H3Event): CloudflareEnv {
  if (!hasAdminKey(event)) throw createError({ statusCode: 403, statusMessage: 'forbidden' })
  return cloudflare(event).env
}

export async function readJson(event: H3Event): Promise<Record<string, any>> {
  const raw = await readRawBody(event, 'utf8')
  try {
    const parsed = JSON.parse(raw || '')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'bad json' })
  }
}

export const now = () => new Date().toISOString()

export async function logEvent(db: D1Database, name: string, ids: { creator?: number | null; collab?: number | null }, props?: Record<string, unknown>) {
  await db.prepare('INSERT INTO events (name, creator_id, collab_id, ts, props) VALUES (?1, ?2, ?3, ?4, ?5)').bind(name, ids.creator ?? null, ids.collab ?? null, now(), props ? JSON.stringify(props) : null).run()
}
