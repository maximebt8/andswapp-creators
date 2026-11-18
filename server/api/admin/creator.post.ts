// Créer ou corriger une fiche créatrice. À la création, le mail d'invitation (avec son lien perso) va dans la file.
export default defineEventHandler(async (event) => {
  const env = requireAdmin(event)
  const body = await readJson(event)
  const id = int(body.id)
  const fields = {
    name: text(body.name, 120),
    handle: text(body.handle, 80).replace(/^@/, '') || null,
    email: text(body.email, 200).toLowerCase(),
    city: text(body.city, 80) || null,
    lang: body.lang === 'fr' ? 'fr' : 'en',
    code: text(body.code, 40).toLowerCase().replace(/[^a-z0-9_-]/g, '') || null,
    notes: text(body.notes, 4000) || null,
  }
  if (!fields.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) throw createError({ statusCode: 400, statusMessage: 'name and email' })

  if (id) {
    await env.DB.prepare('UPDATE creators SET name = ?2, handle = ?3, email = ?4, city = ?5, lang = ?6, code = ?7, notes = ?8, status = COALESCE(?9, status) WHERE id = ?1')
      .bind(id, fields.name, fields.handle, fields.email, fields.city, fields.lang, fields.code, fields.notes, ['invited', 'active', 'paused'].includes(body.status) ? body.status : null)
      .run()
    return { id, link: await creatorLink(env, id) }
  }

  const exists = await env.DB.prepare('SELECT id FROM creators WHERE lower(email) = ?1').bind(fields.email).first<{ id: number }>()
  if (exists) throw createError({ statusCode: 409, statusMessage: 'already there' })
  const result = await env.DB.prepare('INSERT INTO creators (name, handle, email, city, lang, code, notes, status, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)')
    .bind(fields.name, fields.handle, fields.email, fields.city, fields.lang, fields.code, fields.notes, 'invited', now())
    .run()
  const newId = Number(result.meta.last_row_id)
  const link = await creatorLink(env, newId)
  const first = fields.name.split(' ')[0]
  await hold(env.DB, {
    to: fields.email,
    subject: 'Your &Swapp creator space',
    body: `Hi ${first},\n\nGreat to have you on board. Your &Swapp creator space is here:\n${link}\n\nIt is your personal link: your offer, the brief, where you drop your draft, your stats and your payment. Keep it safe, it is yours only.\n\nAny question, just reply to this email or write to me from your space.\n\nMax`,
    kind: 'invite',
    creator: newId,
  })
  await logEvent(env.DB, 'creator_created', { creator: newId })
  return { id: newId, link }
})
