// L'espace d'une créatrice : sa fiche, ses collabs avec ce qu'elles valent, le kit qu'elle peut télécharger.
export default defineEventHandler(async (event) => {
  const me = await requireCreator(event)
  const { env } = cloudflare(event)
  const [collabs, kit] = await Promise.all([collabsOf(env.DB, me.id), kitFor(env.DB, me.id)])
  await env.DB.prepare('UPDATE creators SET last_seen = ?2 WHERE id = ?1').bind(me.id, now()).run()
  const { payout_details, ...safe } = me
  return {
    me: { ...safe, has_payout: !!payout_details, payout_hint: payout_details ? '•••• ' + payout_details.slice(-4) : null },
    collabs,
    kit: kit.map((f) => ({ id: f.id, collab_id: f.collab_id, name: f.name, key: f.key, size: sizeText(f.size), type: f.content_type })),
  }
})
