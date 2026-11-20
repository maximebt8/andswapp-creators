import { payout } from '../../shared/utils/collab'

// Un fichier vers R2 : le brouillon (vidéo ou image), la facture (PDF, image) ou une capture de stats (image, PDF).
// Clé sous c/<créatrice>/<collab>/… La limite tient à la requête Cloudflare (100 Mo) : au-delà, un lien.
const UPLOAD_MAX_BYTES = 100 * 1024 * 1024
const KINDS = { draft: ['video/', 'image/'], invoice: ['application/pdf', 'image/'], stats: ['image/', 'application/pdf'] } as const
type Kind = keyof typeof KINDS

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const me = await requireCreator(event, String(query.t ?? ''))
  const { env } = cloudflare(event)
  const collab = await ownCollab(env.DB, me.id, int(query.collab))
  const kind: Kind = query.kind === 'invoice' ? 'invoice' : query.kind === 'stats' ? 'stats' : 'draft'
  const contentType = getHeader(event, 'content-type') ?? ''
  if (!KINDS[kind].some((prefix) => contentType.startsWith(prefix))) throw createError({ statusCode: 415, statusMessage: 'bad type' })
  const buffer = await readRawBody(event, false)
  if (!buffer || buffer.byteLength === 0 || buffer.byteLength > UPLOAD_MAX_BYTES) throw createError({ statusCode: 413, statusMessage: 'bad size' })
  const name = text(query.name, 80).replace(/[^A-Za-z0-9._-]/g, '_') || 'file'
  const key = `c/${me.id}/${collab.id}/${kind}-${Date.now()}-${name}`
  await env.MEDIA.put(key, buffer, { httpMetadata: { contentType }, customMetadata: { name } })
  const adminLink = `${env.SITE_URL ?? ''}/admin/collab/${collab.id}`
  if (kind === 'invoice') {
    await env.DB.prepare("UPDATE collabs SET invoice_key = ?2, invoice_at = ?3, status = CASE WHEN status IN ('published', 'approved') THEN 'invoiced' ELSE status END WHERE id = ?1").bind(collab.id, key, now()).run()
    await logEvent(env.DB, 'invoice_uploaded', { creator: me.id, collab: collab.id }, { key })
    await tellMax(env, `Facture reçue de ${me.name} pour « ${collab.title} »`, [`${me.name} a déposé sa facture pour « ${collab.title} ». Montant attendu : ${collab.currency} ${payout(collab).total}.`, '', adminLink])
  } else if (kind === 'stats') {
    // Les captures d'insights (à 2 et 7 jours, comme le brief le demande) s'ajoutent, jamais ne se remplacent.
    let list: { key: string; at: string }[] = []
    try { list = JSON.parse(collab.stats_keys ?? '[]') } catch { list = [] }
    list.push({ key, at: now() })
    await env.DB.prepare('UPDATE collabs SET stats_keys = ?2 WHERE id = ?1').bind(collab.id, JSON.stringify(list)).run()
    await logEvent(env.DB, 'stats_uploaded', { creator: me.id, collab: collab.id }, { key })
    await tellMax(env, `Stats de ${me.name} pour « ${collab.title} »`, [`${me.name} a déposé une capture de ses stats (${list.length} au total).`, '', adminLink])
  } else {
    await env.DB.prepare('UPDATE collabs SET draft_key = ?2 WHERE id = ?1').bind(collab.id, key).run()
  }
  return { key }
})
