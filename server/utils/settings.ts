// Les réglages du tableau de bord, une ligne par clé. « reminders » = on/off : le tour automatique du matin.
export async function getSetting(db: D1Database, key: string): Promise<string | null> {
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?1').bind(key).first<{ value: string | null }>()
  return row?.value ?? null
}

export async function setSetting(db: D1Database, key: string, value: string) {
  await db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at').bind(key, value, now()).run()
}

export async function allSettings(db: D1Database): Promise<Record<string, string>> {
  const { results } = await db.prepare('SELECT key, value FROM settings').all<{ key: string; value: string | null }>()
  return Object.fromEntries((results ?? []).map((r) => [r.key, r.value ?? '']))
}
