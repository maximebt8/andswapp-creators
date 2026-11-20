// La file des mails : « Envoie » fait partir un mail retenu (c'est le seul chemin vers une créatrice),
// « Jette » l'abandonne, « Corrige » change le texte avant envoi, « Parti d'Outlook » note qu'il est parti à la main.
export default defineEventHandler(async (event) => {
  const env = requireAdmin(event)
  const body = await readJson(event)
  const id = int(body.id)
  const action = String(body.action ?? '')
  if (action === 'send') {
    const mail = await sendHeld(env, id)
    await logEvent(env.DB, mail.status === 'sent' ? 'mail_sent' : 'mail_error', {}, { id, to: mail.to_email, subject: mail.subject })
    return { ok: mail.status === 'sent', status: mail.status }
  }
  if (action === 'outlook') {
    // max l'a envoyé lui-même depuis Outlook : on le note parti, pour que les rappels et la file sachent.
    await env.DB.prepare("UPDATE outbox SET status = 'sent', sent_at = ?2, error = 'outlook' WHERE id = ?1 AND status = 'held'").bind(id, now()).run()
    await logEvent(env.DB, 'mail_sent_outlook', {}, { id })
    return { ok: true, status: 'sent' }
  }
  if (action === 'drop') {
    await env.DB.prepare("UPDATE outbox SET status = 'dropped' WHERE id = ?1 AND status = 'held'").bind(id).run()
    return { ok: true }
  }
  if (action === 'edit') {
    const subject = text(body.subject, 200)
    const mailBody = text(body.body, 10000)
    if (!subject || !mailBody) throw createError({ statusCode: 400, statusMessage: 'empty' })
    await env.DB.prepare("UPDATE outbox SET subject = ?2, body = ?3 WHERE id = ?1 AND status = 'held'").bind(id, subject, mailBody).run()
    return { ok: true }
  }
  throw createError({ statusCode: 400, statusMessage: 'unknown action' })
})
