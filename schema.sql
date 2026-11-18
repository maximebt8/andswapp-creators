-- Base de l'espace créateurs (D1 andswapp-creators). Schéma additif : on ajoute des colonnes, on n'en retire pas.
-- Rien de la base des inscrits (vie.andswapp.com) ne vit ici.

-- Une créatrice ou un créateur : invité par &Swapp, jamais d'inscription ouverte en V1.
CREATE TABLE IF NOT EXISTS creators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  handle TEXT,                 -- @instagram
  email TEXT NOT NULL,
  city TEXT,                   -- London, Paris
  lang TEXT NOT NULL DEFAULT 'en',
  code TEXT,                   -- le code de son lien perso sur le site &Swapp (?c=clio)
  status TEXT NOT NULL DEFAULT 'invited',   -- invited | active | paused
  payout_name TEXT,            -- nom sur le virement
  payout_details TEXT,         -- IBAN ou sort code + account number, saisi par la créatrice
  invoice_mode TEXT NOT NULL DEFAULT 'self', -- self : elle envoie sa facture ; statement : relevé &Swapp accepté
  notes TEXT,
  created_at TEXT NOT NULL,
  last_seen TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS creators_email ON creators (email);

-- Une collab = une offre, un brief, un contenu, un paiement. Le statut avance dans un seul sens.
-- offered > accepted > draft_submitted > changes_requested > approved > published > invoiced > paid (declined à part)
CREATE TABLE IF NOT EXISTS collabs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_id INTEGER NOT NULL REFERENCES creators (id),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'offered',
  currency TEXT NOT NULL DEFAULT 'GBP',
  fixed_amount REAL NOT NULL DEFAULT 0,       -- 175
  boost_pct REAL NOT NULL DEFAULT 0,          -- 20 : +20 % pour l'usage pub 30 jours
  per_signup REAL NOT NULL DEFAULT 0,         -- 15 par inscrit Londres > Paris
  per_waitlist REAL NOT NULL DEFAULT 0,       -- 5 par inscription liste d'attente
  cap_variable REAL NOT NULL DEFAULT 0,       -- 150 : plafond du variable
  deliverables TEXT,                          -- « 1 Reel + 3 Stories »
  brief TEXT,                                 -- le brief, en texte
  deadline TEXT,                              -- AAAA-MM-JJ
  offered_at TEXT NOT NULL,
  accepted_at TEXT,
  draft_key TEXT,                             -- clé R2 du brouillon
  draft_url TEXT,                             -- ou un lien (Drive, WeTransfer)
  draft_note TEXT,
  draft_at TEXT,
  feedback TEXT,                              -- retour &Swapp sur le brouillon
  approved_at TEXT,
  published_url TEXT,
  published_at TEXT,
  signups INTEGER NOT NULL DEFAULT 0,         -- inscrits venus par son lien
  waitlist INTEGER NOT NULL DEFAULT 0,
  invoice_key TEXT,                           -- sa facture (R2)
  invoice_at TEXT,
  paid_at TEXT,
  paid_amount REAL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS collabs_creator ON collabs (creator_id);

-- (messages : table créée le 18/11 puis abandonnée le jour même, max garde les échanges par mail ; elle reste, vide.)
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  collab_id INTEGER NOT NULL REFERENCES collabs (id),
  author TEXT NOT NULL,        -- creator | andswapp
  body TEXT NOT NULL,
  ts TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_collab ON messages (collab_id);

-- Les mails sortants : écrits par le site, retenus ici, envoyés seulement quand max clique (règle prod du projet).
CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_id INTEGER,
  collab_id INTEGER,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,          -- texte brut
  kind TEXT,                   -- invite | brief | feedback | approved | statement | paid | link
  status TEXT NOT NULL DEFAULT 'held',  -- held | sent | error | dropped
  created_at TEXT NOT NULL,
  sent_at TEXT,
  error TEXT
);

-- Ce qui s'est passé, pour le tableau de bord et les comptes.
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  creator_id INTEGER,
  collab_id INTEGER,
  ts TEXT NOT NULL,
  props TEXT
);
CREATE INDEX IF NOT EXISTS events_ts ON events (ts);
