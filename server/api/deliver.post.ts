// La créatrice envoie son brouillon (fichier déjà déposé, ou un lien) ou dit « c'est publié » avec le lien du post.
export default defineEventHandler(async (event) => {
  const body = await readJson(event)
  const me = await requireCreator(event, String(body.t ?? ''))
  const { env } = cloudflare(event)
  const collab = await ownCollab(env.DB, me.id, int(body.collab))
  const step = body.step === 'published' ? 'published' : 'draft'
  const url = text(body.url, 500)
  const note = text(body.note, 2000)
  const adminLink = `${env.SITE_URL ?? ''}/admin/collab/${collab.id}`

  if (step === 'draft') {
    if (!['accepted', 'changes_requested', 'draft_submitted'].includes(collab.status)) throw createError({ statusCode: 409, statusMessage: 'not now' })
    if (!collab.draft_key && !url) throw createError({ statusCode: 400, statusMessage: 'nothing to send' })
    await env.DB.prepare("UPDATE collabs SET status = 'draft_submitted', draft_url = ?2, draft_note = ?3, draft_at = ?4, feedback = NULL WHERE id = ?1").bind(collab.id, url || null, note || null, now()).run()
    await logEvent(env.DB, 'draft_submitted', { creator: me.id, collab: collab.id })
    const lines = [`${me.name} a envoyé son brouillon pour « ${collab.title} ».`]
    if (note) lines.push(`Son mot : ${note}`)
    if (url) lines.push(`Lien : ${url}`)
    await tellMax(env, `Brouillon de ${me.name} à relire : « ${collab.title} »`, [...lines, '', adminLink])
    return { ok: true, status: 'draft_submitted' }
  }

  if (!['approved', 'published'].includes(collab.status)) throw createError({ statusCode: 409, statusMessage: 'not approved yet' })
  if (!/^https?:\/\//.test(url)) throw createError({ statusCode: 400, statusMessage: 'need a link' })
  await env.DB.prepare("UPDATE collabs SET status = 'published', published_url = ?2, published_at = COALESCE(published_at, ?3) WHERE id = ?1").bind(collab.id, url, now()).run()
  await logEvent(env.DB, 'published', { creator: me.id, collab: collab.id }, { url })
  await tellMax(env, `${me.name} a publié « ${collab.title} »`, [`C'est en ligne : ${url}`, '', adminLink])
  return { ok: true, status: 'published' }
})
