// Un fichier depuis R2 : la créatrice (son jeton) voit les siens et le kit qui la concerne, max (sa clé) voit tout.
export default defineEventHandler(async (event) => {
  const { env } = cloudflare(event)
  const key = String(getQuery(event).key ?? '')
  if (!key.startsWith('c/') && !key.startsWith('kit/')) throw createError({ statusCode: 400, statusMessage: 'bad key' })
  if (!hasAdminKey(event)) {
    const me = await requireCreator(event)
    if (key.startsWith('kit/')) {
      const file = await env.DB.prepare('SELECT k.id FROM kit_files k LEFT JOIN collabs c ON c.id = k.collab_id WHERE k.key = ?1 AND k.hidden = 0 AND (k.collab_id IS NULL OR c.creator_id = ?2)').bind(key, me.id).first()
      if (!file) throw createError({ statusCode: 403, statusMessage: 'forbidden' })
    } else if (!key.startsWith(`c/${me.id}/`)) throw createError({ statusCode: 403, statusMessage: 'forbidden' })
  }
  const object = await env.MEDIA.get(key)
  if (!object) throw createError({ statusCode: 404, statusMessage: 'not found' })
  setHeader(event, 'content-type', object.httpMetadata?.contentType ?? 'application/octet-stream')
  setHeader(event, 'cache-control', 'private, max-age=3600')
  if (getQuery(event).download) setHeader(event, 'content-disposition', `attachment; filename="${object.customMetadata?.name ?? 'file'}"`)
  return object.body
})
