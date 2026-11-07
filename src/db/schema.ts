import type Database from 'better-sqlite3';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  alias         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'moderador', 'cliente')),
  active        INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  parent_id   TEXT REFERENCES categories(id),
  created_at  TEXT NOT NULL,
  CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE TABLE IF NOT EXISTS articles (
  id                 TEXT PRIMARY KEY,
  title              TEXT NOT NULL,
  summary            TEXT NOT NULL,
  category_id        TEXT NOT NULL REFERENCES categories(id),
  current_version_id TEXT REFERENCES article_versions(id),
  created_by         TEXT NOT NULL REFERENCES users(id),
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS article_versions (
  id             TEXT PRIMARY KEY,
  article_id     TEXT NOT NULL REFERENCES articles(id),
  version_number INTEGER NOT NULL CHECK (version_number >= 1),
  title          TEXT NOT NULL,
  summary        TEXT NOT NULL,
  content        TEXT NOT NULL,
  category_id    TEXT NOT NULL REFERENCES categories(id),
  tags           TEXT NOT NULL DEFAULT '[]',
  sources        TEXT NOT NULL DEFAULT '[]',
  change_summary TEXT NOT NULL,
  published_by   TEXT NOT NULL REFERENCES users(id),
  published_at   TEXT NOT NULL,
  proposal_id    TEXT REFERENCES proposals(id),
  UNIQUE (article_id, version_number)
);

CREATE TRIGGER IF NOT EXISTS article_versions_no_update
BEFORE UPDATE ON article_versions
BEGIN
  SELECT RAISE(ABORT, 'Una versión publicada no se modifica');
END;

CREATE TRIGGER IF NOT EXISTS article_versions_no_delete
BEFORE DELETE ON article_versions
BEGIN
  SELECT RAISE(ABORT, 'Una versión publicada no se borra');
END;

CREATE TABLE IF NOT EXISTS proposals (
  id                   TEXT PRIMARY KEY,
  kind                 TEXT NOT NULL CHECK (kind IN ('creacion', 'modificacion')),
  article_id           TEXT REFERENCES articles(id),
  base_version_id      TEXT REFERENCES article_versions(id),
  author_id            TEXT NOT NULL REFERENCES users(id),
  title                TEXT NOT NULL,
  summary              TEXT NOT NULL,
  content              TEXT NOT NULL,
  category_id          TEXT NOT NULL REFERENCES categories(id),
  tags                 TEXT NOT NULL DEFAULT '[]',
  sources              TEXT NOT NULL DEFAULT '[]',
  status               TEXT NOT NULL CHECK (status IN (
                         'abierta', 'en_votacion', 'recomendada', 'desaconsejada',
                         'controvertida', 'aceptada', 'rechazada')),
  community_result     TEXT CHECK (community_result IN ('recomendada', 'desaconsejada', 'controvertida')),
  voting_opened_at     TEXT,
  voting_closed_at     TEXT,
  decision_outcome     TEXT CHECK (decision_outcome IN ('aceptar', 'rechazar')),
  decision_kind        TEXT CHECK (decision_kind IN ('acorde', 'apartada', 'excepcional')),
  decision_reason      TEXT,
  marked_base_as_error INTEGER NOT NULL DEFAULT 0 CHECK (marked_base_as_error IN (0, 1)),
  decided_by           TEXT REFERENCES users(id),
  decided_at           TEXT,
  published_article_id TEXT REFERENCES articles(id),
  published_version_id TEXT REFERENCES article_versions(id),
  created_at           TEXT NOT NULL,
  CHECK (
    (kind = 'creacion' AND article_id IS NULL AND base_version_id IS NULL) OR
    (kind = 'modificacion' AND article_id IS NOT NULL AND base_version_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS comments (
  id          TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL REFERENCES proposals(id),
  author_id   TEXT NOT NULL REFERENCES users(id),
  body        TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS votes (
  id             TEXT PRIMARY KEY,
  proposal_id    TEXT NOT NULL REFERENCES proposals(id),
  moderator_id   TEXT NOT NULL REFERENCES users(id),
  choice         TEXT NOT NULL CHECK (choice IN ('a_favor', 'en_contra')),
  weight_at_vote INTEGER NOT NULL CHECK (weight_at_vote BETWEEN 1 AND 5),
  created_at     TEXT NOT NULL,
  UNIQUE (proposal_id, moderator_id)
);

CREATE TRIGGER IF NOT EXISTS votes_no_update
BEFORE UPDATE ON votes
BEGIN
  SELECT RAISE(ABORT, 'Un voto emitido no se edita');
END;

CREATE TABLE IF NOT EXISTS reputation_events (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  event_type TEXT NOT NULL CHECK (event_type IN (
               'asignacion_inicial', 'aporte_respaldado', 'error_comprobado', 'conducta_abusiva')),
  source_id  TEXT NOT NULL,
  delta      INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, event_type, source_id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id            TEXT PRIMARY KEY,
  actor_id      TEXT NOT NULL REFERENCES users(id),
  action        TEXT NOT NULL CHECK (action IN (
                  'decision_propuesta', 'alta_usuario', 'cambio_usuario', 'conducta_abusiva')),
  entity_type   TEXT NOT NULL CHECK (entity_type IN ('proposal', 'user')),
  entity_id     TEXT NOT NULL,
  reason        TEXT,
  decision_kind TEXT CHECK (decision_kind IN ('acorde', 'apartada', 'excepcional')),
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_versions_article ON article_versions(article_id);
CREATE INDEX IF NOT EXISTS idx_proposals_article ON proposals(article_id);
CREATE INDEX IF NOT EXISTS idx_comments_proposal ON comments(proposal_id);
CREATE INDEX IF NOT EXISTS idx_votes_proposal ON votes(proposal_id);
CREATE INDEX IF NOT EXISTS idx_reputation_user ON reputation_events(user_id);
`;

export function createSchema(database: Database.Database): void {
  database.exec(SCHEMA);
}
