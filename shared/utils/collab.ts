// Ce que vaut une collab, des deux côtés (page créatrice et tableau de bord) : fixe, boost pub, variable plafonné.
export type CollabMoney = { fixed_amount: number; boost_pct: number; per_signup: number; per_waitlist: number; cap_variable: number; signups: number; waitlist: number; currency: string }

export const STATUSES = ['offered', 'accepted', 'draft_submitted', 'changes_requested', 'approved', 'published', 'invoiced', 'paid', 'declined'] as const
export type Status = (typeof STATUSES)[number]

export function payout(c: CollabMoney) {
  const boost = Math.round(c.fixed_amount * (c.boost_pct / 100) * 100) / 100
  const rawVariable = c.signups * c.per_signup + c.waitlist * c.per_waitlist
  const variable = c.cap_variable > 0 ? Math.min(rawVariable, c.cap_variable) : rawVariable
  const total = Math.round((c.fixed_amount + boost + variable) * 100) / 100
  return { fixed: c.fixed_amount, boost, variable: Math.round(variable * 100) / 100, capped: c.cap_variable > 0 && rawVariable > c.cap_variable, total }
}

export const SYMBOL: Record<string, string> = { GBP: '£', EUR: '€', USD: '$' }
export const money = (amount: number, currency = 'GBP') => `${SYMBOL[currency] ?? currency + ' '}${Number(amount).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

// Les mots du statut, côté créatrice (en) et côté &Swapp (fr).
export const STATUS_EN: Record<string, string> = {
  offered: 'Offer to review',
  accepted: 'Accepted, brief ready',
  draft_submitted: 'Draft sent, waiting for feedback',
  changes_requested: 'A tweak requested',
  approved: 'Approved, ready to post',
  published: 'Live',
  invoiced: 'Invoice received',
  paid: 'Paid',
  declined: 'Declined',
}
export const STATUS_FR: Record<string, string> = {
  offered: 'Offre envoyée',
  accepted: 'Acceptée',
  draft_submitted: 'Brouillon à relire',
  changes_requested: 'Retouche demandée',
  approved: 'Validée, à publier',
  published: 'Publiée',
  invoiced: 'Facture reçue, à payer',
  paid: 'Payée',
  declined: 'Refusée',
}
export const STATUS_TONE: Record<string, string> = {
  offered: 'bg-yellow/30 text-green-dark',
  accepted: 'bg-green-light/40 text-green-dark',
  draft_submitted: 'bg-yellow/40 text-green-dark',
  changes_requested: 'bg-orange-100 text-orange-800',
  approved: 'bg-green-light/60 text-green-dark',
  published: 'bg-green-dark text-white',
  invoiced: 'bg-yellow/40 text-green-dark',
  paid: 'bg-gray-200 text-gray-700',
  declined: 'bg-gray-100 text-gray-500',
}
