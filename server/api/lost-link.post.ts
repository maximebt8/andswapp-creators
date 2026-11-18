// « I lost my link » sur la page d'accueil : si l'adresse est connue, le lien est remis dans la file (max clique pour
// l'envoyer) et max est prévenu. Même réponse dans tous les cas : on ne dit pas qui est inscrit.
export default defineEventHandler(async (event) => {
  const body = await readJson(event)
  const { env } = cloudflare(event)
  const email = text(body.email, 200).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw createError({ statusCode: 400, statusMessage: 'bad email' })
  const me = await env.DB.prepare('SELECT id, name, email, link_token FROM creators WHERE lower(email) = ?1').bind(email).first<{ id: number; name: string; email: string; link_token: string | null }>()
  if (me) {
    const link = await creatorLink(env, me)
    await hold(env.DB, { to: me.email, subject: 'Your &Swapp creator link', body: `Hi ${me.name.split(' ')[0]},\n\nHere is your personal link to your &Swapp creator space:\n${link}\n\nKeep it safe, it is yours only.\n\nMax`, kind: 'link', creator: me.id })
    await tellMax(env, `${me.name} redemande son lien créatrice`, [`Le mail est prêt dans la file : ${env.SITE_URL ?? ''}/admin`])
  }
  return { ok: true }
})
