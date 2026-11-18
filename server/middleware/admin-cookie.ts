// /admin?k=<clé> une fois : la clé passe dans un cookie, puis les pages et les API la lisent là.
export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname
  if (!path.startsWith('/admin')) return
  const { env } = cloudflare(event)
  const k = getQuery(event).k
  if (env.ADMIN_KEY && k === env.ADMIN_KEY) setCookie(event, ADMIN_COOKIE, env.ADMIN_KEY, { httpOnly: true, sameSite: 'lax', secure: !path.startsWith('/admin') || getRequestURL(event).protocol === 'https:', path: '/', maxAge: 60 * 60 * 24 * 90 })
})
