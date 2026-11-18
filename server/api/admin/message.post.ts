// Un message de max dans le fil d'une collab. Il s'affiche dans l'espace de la créatrice ; un mail « Max wrote to you »
// va dans la file si max le demande (notify).
export default defineEventHandler(async (event) => {
  const env = requireAdmin(event)
  const body = await readJson(event)
  const collab = await env.DB.prepare('SELECT c.*, k.email, k.name FROM collabs c JOIN creators k ON k.id = c.creator_id WHERE c.id = ?1').bind(int(body.id)).first<CollabRow & { email: string; name: string }>()
  if (!collab) throw createError({ statusCode: 404, statusMessage: 'no such collab' })
  const message = text(body.body, 3000)
  if (!message) throw createError({ statusCode: 400, statusMessage: 'empty' })
  await env.DB.prepare('INSERT INTO messages (collab_id, author, body, ts) VALUES (?1, ?2, ?3, ?4)').bind(collab.id, 'andswapp', message, now()).run()
  if (body.notify) {
    const link = await creatorLink(env, collab.creator_id)
    await hold(env.DB, { to: collab.email, subject: `Max wrote to you about ${collab.title}`, body: `Hi ${collab.name.split(' ')[0]},\n\n${message}\n\nReply from your space:\n${link}\n\nMax`, kind: 'message', creator: collab.creator_id, collab: collab.id })
  }
  return { ok: true }
})
