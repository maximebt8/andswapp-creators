# Consignes Claude pour andswapp-creators

Lire `README.md` d'abord (ce que c'est, stack, lancement, déploiement).

- Espace interne &Swapp, sur invitation seulement. Aucune inscription ouverte.
- La base D1 `andswapp-creators` est à part : rien de la base des inscrits (vie.andswapp.com) ne vit ici, et ce site n'écrit jamais là-bas.
- Jamais de `DELETE`, `DROP` ni purge en prod. Schéma additif seulement (`ALTER TABLE … ADD COLUMN`).
- Aucun mail ne part vers une créatrice sans le clic « Envoie » de max dans le tableau de bord. Les mails s'écrivent dans `outbox` et attendent. Seuls les mots à max (`tellMax`) partent seuls.
- L'argent ne bouge pas depuis le site : le virement se prépare dans Qonto et part avec la validation de max.
- Textes : côté créatrice en anglais, simple et chaleureux ; côté tableau de bord en français, tutoiement, phrases courtes, jamais de tiret long.
- Déployer seulement après vérification en local ; la mise en ligne passe par le workflow GitHub `mise-en-ligne`, lancé par l'agent, jamais une commande Terminal demandée à max.
