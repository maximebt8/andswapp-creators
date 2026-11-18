import { payout } from '../../../shared/utils/collab'

// Une collab en détail : la fiche créatrice (avec ses coordonnées de virement), les mails liés.
export default defineEventHandler(async (event) => {
  const env = requireAdmin(event)
  const id = int(getQuery(event).id)
  const collab = await env.DB.prepare('SELECT * FROM collabs WHERE id = ?1').bind(id).first<CollabRow>()
  if (!collab) throw createError({ statusCode: 404, statusMessage: 'no such collab' })
  const [creator, outbox] = await Promise.all([
    env.DB.prepare('SELECT * FROM creators WHERE id = ?1').bind(collab.creator_id).first<CreatorRow>(),
    env.DB.prepare('SELECT * FROM outbox WHERE collab_id = ?1 OR (creator_id = ?2 AND collab_id IS NULL) ORDER BY id DESC').bind(id, collab.creator_id).all<any>(),
  ])
  return { collab: { ...collab, money: payout(collab) }, creator, outbox: outbox.results ?? [], link: creator ? await creatorLink(env, creator.id) : null }
})
