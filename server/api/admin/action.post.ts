import { money, payout } from '../../../shared/utils/collab'

// Les gestes de max sur une collab : retour sur le brouillon, validation, compteurs, payée, refusée. Chaque geste qui
// concerne la créatrice écrit un mail dans la file ; rien ne part sans le clic « Envoie ».
export default defineEventHandler(async (event) => {
  const env = requireAdmin(event)
  const body = await readJson(event)
  const collab = await env.DB.prepare('SELECT * FROM collabs WHERE id = ?1').bind(int(body.id)).first<CollabRow>()
  if (!collab) throw createError({ statusCode: 404, statusMessage: 'no such collab' })
  const creator = await env.DB.prepare('SELECT * FROM creators WHERE id = ?1').bind(collab.creator_id).first<CreatorRow>()
  if (!creator) throw createError({ statusCode: 404, statusMessage: 'no such creator' })
  const first = creator.name.split(' ')[0]
  const link = await creatorLink(env, creator.id)
  const ids = { creator: creator.id, collab: collab.id }
  const action = String(body.action ?? '')

  if (action === 'changes') {
    const feedback = text(body.feedback, 4000)
    if (!feedback) throw createError({ statusCode: 400, statusMessage: 'say what to change' })
    await env.DB.prepare("UPDATE collabs SET status = 'changes_requested', feedback = ?2 WHERE id = ?1").bind(collab.id, feedback).run()
    await hold(env.DB, { to: creator.email, subject: `One tweak on your draft: ${collab.title}`, body: `Hi ${first},\n\nThanks for the draft, I love it. One small thing:\n\n${feedback}\n\nDrop the new version in your space when ready:\n${link}\n\nMax`, kind: 'feedback', ...ids })
    await logEvent(env.DB, 'changes_requested', ids)
    return { ok: true, status: 'changes_requested' }
  }

  if (action === 'approve') {
    const note = text(body.note, 2000)
    await env.DB.prepare("UPDATE collabs SET status = 'approved', approved_at = ?2, feedback = NULL WHERE id = ?1").bind(collab.id, now()).run()
    await hold(env.DB, { to: creator.email, subject: `Approved, you can post: ${collab.title}`, body: `Hi ${first},\n\nYour draft is approved, go ahead and post it.${note ? `\n\n${note}` : ''}\n\nOnce it is live, paste the link in your space so we can track it:\n${link}\n\nMax`, kind: 'approved', ...ids })
    await logEvent(env.DB, 'approved', ids)
    return { ok: true, status: 'approved' }
  }

  if (action === 'counts') {
    const signups = Math.max(0, int(body.signups, collab.signups))
    const waitlist = Math.max(0, int(body.waitlist, collab.waitlist))
    await env.DB.prepare('UPDATE collabs SET signups = ?2, waitlist = ?3 WHERE id = ?1').bind(collab.id, signups, waitlist).run()
    await logEvent(env.DB, 'counts_set', ids, { signups, waitlist })
    return { ok: true, money: payout({ ...collab, signups, waitlist }) }
  }

  if (action === 'statement') {
    // Le relevé : ce qu'on lui doit, ligne par ligne, pour qu'elle facture (ou qu'elle l'accepte comme relevé).
    const m = payout(collab)
    const lines = [`Hi ${first},`, '', `Here is the statement for « ${collab.title} »:`, `Fixed: ${money(m.fixed, collab.currency)}`]
    if (m.boost) lines.push(`Paid usage (+${collab.boost_pct}%): ${money(m.boost, collab.currency)}`)
    if (collab.per_signup || collab.per_waitlist) lines.push(`Sign-ups: ${collab.signups} × ${money(collab.per_signup, collab.currency)}${collab.per_waitlist ? ` + ${collab.waitlist} waitlist × ${money(collab.per_waitlist, collab.currency)}` : ''} = ${money(m.variable, collab.currency)}${m.capped ? ' (capped)' : ''}`)
    lines.push(`Total: ${money(m.total, collab.currency)}`, '', creator.invoice_mode === 'statement' ? 'Reply "ok" to this email and the transfer goes out.' : 'Send me your invoice for this amount (upload it in your space, or reply to this email) and the transfer goes out.', link, '', 'Max')
    await hold(env.DB, { to: creator.email, subject: `Your &Swapp statement: ${money(m.total, collab.currency)}`, body: lines.join('\n'), kind: 'statement', ...ids })
    await logEvent(env.DB, 'statement_held', ids, { total: m.total })
    return { ok: true }
  }

  if (action === 'paid') {
    const amount = int(body.amount, payout(collab).total)
    await env.DB.prepare("UPDATE collabs SET status = 'paid', paid_at = ?2, paid_amount = ?3 WHERE id = ?1").bind(collab.id, now(), amount).run()
    await hold(env.DB, { to: creator.email, subject: `Payment sent: ${money(amount, collab.currency)}`, body: `Hi ${first},\n\nThe transfer of ${money(amount, collab.currency)} for « ${collab.title} » went out today. Thank you, it was a pleasure.\n\nMax`, kind: 'paid', ...ids })
    await logEvent(env.DB, 'paid', ids, { amount })
    return { ok: true, status: 'paid' }
  }

  if (action === 'decline') {
    await env.DB.prepare("UPDATE collabs SET status = 'declined' WHERE id = ?1").bind(collab.id).run()
    await logEvent(env.DB, 'declined_by_andswapp', ids)
    return { ok: true, status: 'declined' }
  }

  if (action === 'reopen') {
    await env.DB.prepare("UPDATE collabs SET status = 'accepted' WHERE id = ?1").bind(collab.id).run()
    return { ok: true, status: 'accepted' }
  }

  throw createError({ statusCode: 400, statusMessage: 'unknown action' })
})
