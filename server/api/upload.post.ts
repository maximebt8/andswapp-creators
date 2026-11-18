import { payout } from '../../shared/utils/collab'

// Un fichier vers R2 : le brouillon (vidéo ou image) ou la facture (PDF, image). Clé sous c/<créatrice>/<collab>/…
const MAX_BYTES = 200 * 1024 * 1024
const KINDS = { draft: ['video/', 'image/'], invoice: ['application/pdf', 'image/'] } as const

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const me = await requireCreator(event, String(query.t ?? ''))
  const { env } = cloudflare(event)
  const collab = await ownCollab(env.DB, me.id, int(query.collab))
  const kind = query.kind === 'invoice' ? 'invoice' : 'draft'
  const contentType = getHeader(event, 'content-type') ?? ''
  if (!KINDS[kind].some((prefix) => contentType.startsWith(prefix))) throw createError({ statusCode: 415, statusMessage: 'bad type' })
  const buffer = await readRawBody(event, false)
  if (!buffer || buffer.byteLength === 0 || buffer.byteLength > MAX_BYTES) throw createError({ statusCode: 413, statusMessage: 'bad size' })
  const name = text(query.name, 80).replace(/[^A-Za-z0-9._-]/g, '_') || 'file'
  const key = `c/${me.id}/${collab.id}/${kind}-${Date.now()}-${name}`
  await env.MEDIA.put(key, buffer, { httpMetadata: { contentType }, customMetadata: { name } })
  if (kind === 'invoice') {
    await env.DB.prepare("UPDATE collabs SET invoice_key = ?2, invoice_at = ?3, status = CASE WHEN status IN ('published', 'approved') THEN 'invoiced' ELSE status END WHERE id = ?1").bind(collab.id, key, now()).run()
    await logEvent(env.DB, 'invoice_uploaded', { creator: me.id, collab: collab.id }, { key })
    await tellMax(env, `Facture reçue de ${me.name} pour « ${collab.title} »`, [`${me.name} a déposé sa facture pour « ${collab.title} ». Montant attendu : ${collab.currency} ${payout(collab).total}.`, '', `${env.SITE_URL ?? ''}/admin/collab/${collab.id}`])
  } else {
    await env.DB.prepare('UPDATE collabs SET draft_key = ?2 WHERE id = ?1').bind(collab.id, key).run()
  }
  return { key }
})
