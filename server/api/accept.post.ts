// « Accept the offer » ou « Decline », un clic, horodaté. max est prévenu tout de suite.
export default defineEventHandler(async (event) => {
  const body = await readJson(event)
  const me = await requireCreator(event, String(body.t ?? ''))
  const { env } = cloudflare(event)
  const collab = await ownCollab(env.DB, me.id, int(body.collab))
  if (collab.status !== 'offered') return { ok: true, status: collab.status }
  const accept = body.accept !== false
  const status = accept ? 'accepted' : 'declined'
  await env.DB.batch([
    env.DB.prepare('UPDATE collabs SET status = ?2, accepted_at = ?3 WHERE id = ?1').bind(collab.id, status, accept ? now() : null),
    env.DB.prepare("UPDATE creators SET status = 'active' WHERE id = ?1 AND status = 'invited'").bind(me.id),
  ])
  await logEvent(env.DB, accept ? 'offer_accepted' : 'offer_declined', { creator: me.id, collab: collab.id })
  await tellMax(env, `${me.name} ${accept ? 'a accepté' : 'a refusé'} l'offre « ${collab.title} »`, [`${me.name} (${me.handle ?? me.email}) ${accept ? 'a accepté' : 'a refusé'} l'offre « ${collab.title} ».`, '', `${env.SITE_URL ?? ''}/admin/collab/${collab.id}`])
  return { ok: true, status }
})
