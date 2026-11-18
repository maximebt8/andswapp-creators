// Les mails aux créatrices : écrits par le site, retenus dans outbox, envoyés seulement quand max clique « Envoie »
// dans le tableau de bord (règle prod du projet : rien vers un membre sans son go). Brevo en transactionnel.
const API = 'https://api.brevo.com/v3'
const SENDER = { name: 'Max from &Swapp', email: 'hello@andswapp.com' }

type MailEnv = { DB: D1Database; BREVO_API_KEY?: string; MAX_EMAIL?: string }
export type Draft = { to: string; subject: string; body: string; kind: string; creator?: number | null; collab?: number | null }

export async function hold(db: D1Database, draft: Draft) {
  const result = await db
    .prepare('INSERT INTO outbox (creator_id, collab_id, to_email, subject, body, kind, status, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)')
    .bind(draft.creator ?? null, draft.collab ?? null, draft.to, draft.subject, draft.body, draft.kind, 'held', now())
    .run()
  return Number(result.meta.last_row_id)
}

const escape = (text: string) => String(text ?? '').replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char] as string)
const html = (body: string) =>
  `<div style="font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#111827;max-width:560px">${body
    .split('\n')
    .map((line) => (line.trim() ? `<p style="margin:0 0 12px">${escape(line).replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" style="color:#2E5941">$1</a>')}</p>` : ''))
    .join('')}<p style="margin:18px 0 0;color:#6B7280;font-size:13px">&amp;Swapp · andswapp.com</p></div>`

// Un mail retenu part, une fois. En local sans clé Brevo, il s'écrit dans la console et passe en « sent » quand même.
// En ligne sans clé Brevo, on refuse : un mail marqué envoyé qui n'est jamais parti serait pire que tout.
export async function sendHeld(env: MailEnv, id: number) {
  const mail = await env.DB.prepare('SELECT * FROM outbox WHERE id = ?1').bind(id).first<{ id: number; to_email: string; subject: string; body: string; status: string }>()
  if (!mail) throw createError({ statusCode: 404, statusMessage: 'no such mail' })
  if (mail.status === 'sent') return mail
  if (!env.BREVO_API_KEY) {
    if (!import.meta.dev) throw createError({ statusCode: 503, statusMessage: 'no brevo key: copy the text and send it from Outlook' })
    console.log(`[mail non envoyé, pas de clé Brevo] à ${mail.to_email} : ${mail.subject}\n${mail.body}`)
    await env.DB.prepare("UPDATE outbox SET status = 'sent', sent_at = ?2, error = 'local' WHERE id = ?1").bind(id, now()).run()
    return { ...mail, status: 'sent' }
  }
  let status = 'error'
  try {
    const response = await fetch(API + '/smtp/email', {
      method: 'POST',
      headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sender: SENDER, replyTo: { email: env.MAX_EMAIL ?? SENDER.email, name: 'Max' }, to: [{ email: mail.to_email }], subject: mail.subject, textContent: mail.body, htmlContent: html(mail.body), tags: ['creators'] }),
    })
    status = response.ok ? 'sent' : `error ${response.status}`
  } catch {
    /* réseau */
  }
  await env.DB.prepare('UPDATE outbox SET status = ?2, sent_at = ?3, error = ?4 WHERE id = ?1').bind(id, status === 'sent' ? 'sent' : 'error', status === 'sent' ? now() : null, status === 'sent' ? null : status).run()
  return { ...mail, status: status === 'sent' ? 'sent' : 'error' }
}

// Un mot à max (interne, part tout de suite) quand une créatrice fait quelque chose : accepte, dépose, publie, facture.
export async function tellMax(env: MailEnv, subject: string, lines: string[]) {
  if (!env.BREVO_API_KEY) return console.log(`[mail à max, non envoyé] ${subject}\n${lines.join('\n')}`)
  try {
    await fetch(API + '/smtp/email', {
      method: 'POST',
      headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sender: { name: '&Swapp Creators', email: SENDER.email }, to: [{ email: env.MAX_EMAIL ?? 'maxoubarret@gmail.com' }], subject, textContent: lines.join('\n'), htmlContent: html(lines.join('\n')), tags: ['creators-interne'] }),
    })
  } catch {
    /* jamais bloquant */
  }
}
