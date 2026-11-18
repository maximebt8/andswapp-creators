// Un message de la créatrice dans le fil de sa collab. max est prévenu.
export default defineEventHandler(async (event) => {
  const body = await readJson(event)
  const me = await requireCreator(event, String(body.t ?? ''))
  const { env } = cloudflare(event)
  const collab = await ownCollab(env.DB, me.id, int(body.collab))
  const message = text(body.body, 3000)
  if (!message) throw createError({ statusCode: 400, statusMessage: 'empty' })
  await env.DB.prepare('INSERT INTO messages (collab_id, author, body, ts) VALUES (?1, ?2, ?3, ?4)').bind(collab.id, 'creator', message, now()).run()
  await tellMax(env, `Message de ${me.name} (« ${collab.title} »)`, [message, '', `${env.SITE_URL ?? ''}/admin/collab/${collab.id}`])
  return { ok: true }
})
