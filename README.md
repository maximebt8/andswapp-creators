# andswapp-creators

L'espace créateurs &Swapp (creators.andswapp.com) : une plateforme interne pour gérer les créatrices et créateurs de contenu avec qui &Swapp travaille, sur le modèle des outils du marché (Impact, Aspire, Grin), en version simple et privée.

- Côté créatrice (en anglais, mise en page du portail partenaire Impact : menu à gauche Dashboard, Campaigns, Content, Tracking, Payments, Profile) : un lien perso, l'offre à accepter en un clic, le brief, le dépôt du brouillon (fichier ou lien), le lien du post une fois publié, le compteur d'inscrits venus par son lien, ce que ça vaut, sa facture, ses coordonnées de virement. Les échanges avec Max restent par mail.
- Côté &Swapp (`/admin`, en français) : la file des mails à envoyer, ce qui attend un geste, les collabs par statut, les créatrices, les totaux (à payer, payé, inscrits, coût par inscrit), et par collab : relire le brouillon, valider ou demander une retouche, mettre à jour les compteurs, préparer le relevé, marquer payée.

Le statut d'une collab avance dans un seul sens : `offered` → `accepted` → `draft_submitted` → (`changes_requested` →) `approved` → `published` → `invoiced` → `paid`. `declined` à part.

Ce que vaut une collab : fixe + boost pub (en % du fixe) + variable (inscrits × prix + liste d'attente × prix, plafonné). Le calcul vit dans `shared/utils/collab.ts`, lu des deux côtés.

## Règles

- Sur invitation : max crée la fiche dans `/admin`, le site prépare le mail d'invitation avec le lien perso, max clique « Envoie ». Le lien perso (`/c/<id>.<signature>`, HMAC avec `ADMIN_KEY`) est la connexion : qui a le lien est la personne.
- Aucun mail ne part vers une créatrice sans le clic de max : tout passe par la table `outbox` (held → sent). Seuls les mots à max partent tout de suite (`tellMax`).
- Le site ne déplace pas d'argent. Le virement se prépare dans Qonto, max le valide, puis « Payée » dans `/admin`.
- Base D1 à part (`andswapp-creators`), bucket R2 à part (`andswapp-creators-media`). Rien de partagé avec vie.andswapp.com.

## Stack

Nuxt 4, Vue 3, Tailwind 4, daisyUI, Nitro en `cloudflare-pages`. Le design system CSS (`app/assets/main.css`, `app/assets/components/`) est copié tel quel depuis GTM-VIE, lui-même copié depuis `andswapp/frontend-nuxt`.

- Prod : https://creators.andswapp.com (Cloudflare Pages, projet `andswapp-creators`)
- Données : D1 `andswapp-creators` (schéma dans `schema.sql`), fichiers dans R2 `andswapp-creators-media`
- Secrets de prod (Cloudflare Pages, Settings, Variables) : `ADMIN_KEY` (clé du tableau de bord et des liens perso), `BREVO_API_KEY`, `MAX_EMAIL`, `SITE_URL`

## Lancer en local

Node 22. Un fichier `.dev.vars` à la racine (jamais versionné), à copier depuis `.dev.vars.example`.

```bash
npm ci
npm run db:local
npm run dev:cf
```

Le site tourne sur http://localhost:4705 avec une base D1 et un bucket R2 locaux, vides au départ. Tableau de bord : http://localhost:4705/admin?k=<ADMIN_KEY>. Sans clé Brevo, les mails « envoyés » s'écrivent dans la console du serveur.

## Déployer

Le workflow `mise-en-ligne` (onglet Actions, à la demande) construit `main` dans une copie propre et le publie. Il lui faut le secret `CLOUDFLARE_API_TOKEN` du dépôt (droit Cloudflare Pages, Edit). Rien ne part tout seul à la fusion.

À la main : `npm run deploy`.

Première mise en ligne : créer le projet Pages `andswapp-creators` (le premier `wrangler pages deploy` le crée), poser les secrets dans Cloudflare, exécuter `schema.sql` sur la base de prod (`npx wrangler d1 execute andswapp-creators --remote --file schema.sql`), puis brancher le domaine `creators.andswapp.com` sur le projet Pages.

## Pièges connus

Ceux de GTM-VIE valent ici (même stack) : une déclaration exportée par ligne dans `server/utils` (l'import automatique ne voit pas `export const A = 1, B = 2`), pas de transaction interactive en D1 (lire, calculer, puis un seul `db.batch`), le build est le seul garde-fou (pas de `tsc` en place).
