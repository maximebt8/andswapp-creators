// max dépose un fichier du kit : ?name=…&collab=<id ou rien>, le fichier en corps brut. Clé R2 sous kit/….
const MAX_BYTES = 100 * 1024 * 1024
const TYPES = ['image/', 'video/', 'application/pdf', 'application/zip', 'font/', 'application/vnd.openxmlformats', 'text/plain']

export default defineEventHandler(async (event) => {
  const env = requireAdmin(event)
  const query = getQuery(event)
  const collabId = int(query.collab) || null
  if (collabId) {
    const exists = await env.DB.prepare('SELECT id FROM collabs WHERE id = ?1').bind(collabId).first()
    if (!exists) throw createError({ statusCode: 404, statusMessage: 'no such collab' })
  }
  const contentType = getHeader(event, 'content-type') ?? 'application/octet-stream'
  if (!TYPES.some((prefix) => contentType.startsWith(prefix))) throw createError({ statusCode: 415, statusMessage: 'bad type' })
  const buffer = await readRawBody(event, false)
  if (!buffer || buffer.byteLength === 0 || buffer.byteLength > MAX_BYTES) throw createError({ statusCode: 413, statusMessage: 'bad size' })
  const name = text(query.name, 80).replace(/[^A-Za-z0-9._-]/g, '_') || 'file'
  const key = `kit/${collabId ?? 'shared'}/${Date.now()}-${name}`
  await env.MEDIA.put(key, buffer, { httpMetadata: { contentType }, customMetadata: { name } })
  const result = await env.DB.prepare('INSERT INTO kit_files (collab_id, name, key, size, content_type, hidden, created_at) VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6)').bind(collabId, name, key, buffer.byteLength, contentType, now()).run()
  await logEvent(env.DB, 'kit_added', { collab: collabId }, { key, size: buffer.byteLength })
  return { id: Number(result.meta.last_row_id), key }
})
