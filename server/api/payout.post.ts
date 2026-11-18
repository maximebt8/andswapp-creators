// Les coordonnées de virement de la créatrice (nom du compte, IBAN ou sort code + account number), saisies par elle.
// Lues seulement par max au moment de préparer le virement.
export default defineEventHandler(async (event) => {
  const body = await readJson(event)
  const me = await requireCreator(event, String(body.t ?? ''))
  const { env } = cloudflare(event)
  const name = text(body.payout_name, 120)
  const details = text(body.payout_details, 200)
  const mode = body.invoice_mode === 'statement' ? 'statement' : 'self'
  if (!name || !details) throw createError({ statusCode: 400, statusMessage: 'missing' })
  await env.DB.prepare('UPDATE creators SET payout_name = ?2, payout_details = ?3, invoice_mode = ?4 WHERE id = ?1').bind(me.id, name, details, mode).run()
  await logEvent(env.DB, 'payout_details_saved', { creator: me.id })
  return { ok: true }
})
