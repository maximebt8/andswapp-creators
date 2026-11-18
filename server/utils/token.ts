import type { H3Event } from 'h3'

// Le lien perso d'une créatrice : « <id>.<signature> », signé avec ADMIN_KEY (HMAC-SHA256, 20 car.).
// Rien à stocker, impossible à deviner, révocable en changeant la clé. Qui a le lien est la personne :
// il ne part qu'à son adresse. Un vrai compte avec mot de passe le jour où il y a plus que quelques dizaines de créateurs.
async function hmac(secret: string, text: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('creator:' + text)))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').slice(0, 20)
}

export async function signCreator(secret: string, id: number) {
  return `${id}.${await hmac(secret, String(id))}`
}

export async function verifyCreator(secret: string | undefined, token: string): Promise<number | null> {
  const match = /^(\d{1,9})\.([A-Za-z0-9_-]{20})$/.exec(token)
  if (!secret || !match) return null
  return (await hmac(secret, match[1]!)) === match[2] ? Number(match[1]) : null
}

export type CreatorRow = { id: number; name: string; handle: string | null; email: string; city: string | null; lang: string; code: string | null; status: string; payout_name: string | null; payout_details: string | null; invoice_mode: string; notes: string | null; created_at: string; last_seen: string | null }

// La créatrice derrière un jeton (?t= ou le corps). 404 si le lien ne vaut rien.
export async function requireCreator(event: H3Event, token?: string): Promise<CreatorRow> {
  const { env } = cloudflare(event)
  const t = token ?? String(getQuery(event).t ?? '')
  const id = await verifyCreator(env.ADMIN_KEY, t)
  const row = id ? await env.DB.prepare('SELECT * FROM creators WHERE id = ?1').bind(id).first<CreatorRow>() : null
  if (!row) throw createError({ statusCode: 404, statusMessage: 'unknown link' })
  return row
}

export async function creatorLink(env: { ADMIN_KEY?: string; SITE_URL?: string }, id: number) {
  return `${env.SITE_URL ?? 'https://creators.andswapp.com'}/c/${await signCreator(env.ADMIN_KEY ?? '', id)}`
}
