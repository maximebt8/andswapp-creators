import { money } from '../../../shared/utils/collab'
import { nice, postWindow } from '../../../shared/utils/dates'

// Créer ou corriger une collab (l'offre, le brief, les dates, les messages clés, la légende). À la création, le mail
// « ton offre » va dans la file.
export default defineEventHandler(async (event) => {
  const env = requireAdmin(event)
  const body = await readJson(event)
  const id = int(body.id)
  const creatorId = int(body.creator_id)
  const creator = await env.DB.prepare('SELECT * FROM creators WHERE id = ?1').bind(creatorId).first<CreatorRow>()
  if (!creator) throw createError({ statusCode: 404, statusMessage: 'no such creator' })
  const f = {
    title: text(body.title, 140) || `Collab ${creator.name}`,
    currency: ['GBP', 'EUR', 'USD'].includes(body.currency) ? body.currency : 'GBP',
    fixed_amount: int(body.fixed_amount),
    boost_pct: int(body.boost_pct),
    per_signup: int(body.per_signup),
    per_waitlist: int(body.per_waitlist),
    cap_variable: int(body.cap_variable),
    deliverables: text(body.deliverables, 500) || null,
    brief: text(body.brief, 20000) || null,
    deadline: isoDay(body.deadline),
    draft_due: isoDay(body.draft_due),
    post_from: isoDay(body.post_from),
    key_messages: text(body.key_messages, 2000) || null,
    caption: text(body.caption, 4000) || null,
  }

  if (id) {
    await env.DB.prepare('UPDATE collabs SET title = ?2, currency = ?3, fixed_amount = ?4, boost_pct = ?5, per_signup = ?6, per_waitlist = ?7, cap_variable = ?8, deliverables = ?9, brief = ?10, deadline = ?11, draft_due = ?13, post_from = ?14, key_messages = ?15, caption = ?16 WHERE id = ?1 AND creator_id = ?12')
      .bind(id, f.title, f.currency, f.fixed_amount, f.boost_pct, f.per_signup, f.per_waitlist, f.cap_variable, f.deliverables, f.brief, f.deadline, creatorId, f.draft_due, f.post_from, f.key_messages, f.caption)
      .run()
    return { id }
  }

  const result = await env.DB.prepare('INSERT INTO collabs (creator_id, title, status, currency, fixed_amount, boost_pct, per_signup, per_waitlist, cap_variable, deliverables, brief, deadline, offered_at, created_at, draft_due, post_from, key_messages, caption) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?13, ?14, ?15, ?16, ?17)')
    .bind(creatorId, f.title, 'offered', f.currency, f.fixed_amount, f.boost_pct, f.per_signup, f.per_waitlist, f.cap_variable, f.deliverables, f.brief, f.deadline, now(), f.draft_due, f.post_from, f.key_messages, f.caption)
    .run()
  const newId = Number(result.meta.last_row_id)
  const link = await creatorLink(env, creator)
  const first = creator.name.split(' ')[0]
  const variable = f.per_signup ? `, plus ${money(f.per_signup, f.currency)} per London > Paris sign-up through your link${f.per_waitlist ? ` (${money(f.per_waitlist, f.currency)} per waitlist sign-up)` : ''}${f.cap_variable ? `, capped at ${money(f.cap_variable, f.currency)}` : ''}` : ''
  const boost = f.boost_pct ? ` and +${f.boost_pct}% for 30 days of paid usage` : ''
  const dates = [f.draft_due ? `Draft by ${nice(f.draft_due)}` : '', postWindow(f.post_from, f.deadline) ? `post ${postWindow(f.post_from, f.deadline)}` : ''].filter(Boolean).join(', ')
  await hold(env.DB, {
    to: creator.email,
    subject: `Your &Swapp offer: ${f.title}`,
    body: `Hi ${first},\n\nYour offer is ready in your creator space:\n${link}\n\n${f.deliverables ?? 'The content'} for ${money(f.fixed_amount, f.currency)}${boost}${variable}.${dates ? `\n${dates}.` : ''}\n\nOne click to accept, and the brief is right there.\n\nMax`,
    kind: 'offer',
    creator: creator.id,
    collab: newId,
  })
  await logEvent(env.DB, 'collab_offered', { creator: creator.id, collab: newId })
  return { id: newId }
})
