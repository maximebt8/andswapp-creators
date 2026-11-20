// Le kit : les fichiers que max dépose pour les créatrices (logo, visuels, captures d'app). collab_id NULL = pour toutes.
export type KitRow = { id: number; collab_id: number | null; name: string; key: string; size: number; content_type: string | null; hidden: number; created_at: string }

// Ce qu'une créatrice peut télécharger : le kit commun et le kit de ses collabs.
export async function kitFor(db: D1Database, creatorId: number): Promise<KitRow[]> {
  const { results } = await db
    .prepare('SELECT k.* FROM kit_files k LEFT JOIN collabs c ON c.id = k.collab_id WHERE k.hidden = 0 AND (k.collab_id IS NULL OR c.creator_id = ?1) ORDER BY k.collab_id IS NULL DESC, k.id DESC')
    .bind(creatorId)
    .all<KitRow>()
  return results ?? []
}

export const sizeText = (bytes: number) => (bytes >= 1024 * 1024 ? `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)
