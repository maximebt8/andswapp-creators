// Un réglage du tableau de bord : { key, value }. Seules les clés connues passent.
const KEYS: Record<string, string[]> = { reminders: ['on', 'off'] }

export default defineEventHandler(async (event) => {
  const env = requireAdmin(event)
  const body = await readJson(event)
  const key = String(body.key ?? '')
  const value = String(body.value ?? '')
  if (!KEYS[key] || !KEYS[key].includes(value)) throw createError({ statusCode: 400, statusMessage: 'unknown setting' })
  await setSetting(env.DB, key, value)
  await logEvent(env.DB, 'setting_changed', {}, { key, value })
  return { ok: true, key, value }
})
