// Un fichier depuis R2 : la créatrice (son jeton) voit les siens, max (sa clé) voit tout.
export default defineEventHandler(async (event) => {
  const { env } = cloudflare(event)
  const key = String(getQuery(event).key ?? '')
  if (!key.startsWith('c/')) throw createError({ statusCode: 400, statusMessage: 'bad key' })
  if (!hasAdminKey(event)) {
    const me = await requireCreator(event)
    if (!key.startsWith(`c/${me.id}/`)) throw createError({ statusCode: 403, statusMessage: 'forbidden' })
  }
  const object = await env.MEDIA.get(key)
  if (!object) throw createError({ statusCode: 404, statusMessage: 'not found' })
  setHeader(event, 'content-type', object.httpMetadata?.contentType ?? 'application/octet-stream')
  setHeader(event, 'cache-control', 'private, max-age=3600')
  if (getQuery(event).download) setHeader(event, 'content-disposition', `attachment; filename="${object.customMetadata?.name ?? 'file'}"`)
  return object.body
})
