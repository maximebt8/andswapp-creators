// L'espace d'une créatrice : sa fiche, ses collabs avec ce qu'elles valent.
export default defineEventHandler(async (event) => {
  const me = await requireCreator(event)
  const { env } = cloudflare(event)
  const collabs = await collabsOf(env.DB, me.id)
  await env.DB.prepare('UPDATE creators SET last_seen = ?2 WHERE id = ?1').bind(me.id, now()).run()
  const { payout_details, ...safe } = me
  return { me: { ...safe, has_payout: !!payout_details, payout_hint: payout_details ? '•••• ' + payout_details.slice(-4) : null }, collabs }
})
