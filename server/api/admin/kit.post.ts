// Retirer (ou remettre) un fichier du kit : { id, hidden: true|false }. Jamais de DELETE, le fichier reste dans R2.
export default defineEventHandler(async (event) => {
  const env = requireAdmin(event)
  const body = await readJson(event)
  const id = int(body.id)
  if (!id) throw createError({ statusCode: 400, statusMessage: 'which file' })
  await env.DB.prepare('UPDATE kit_files SET hidden = ?2 WHERE id = ?1').bind(id, body.hidden === false ? 0 : 1).run()
  return { ok: true }
})
