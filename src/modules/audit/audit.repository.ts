import { db } from '../../db/connection';
import type { AuditAction, AuditEntityType, AuditEntry, DecisionKind, NewAuditEntry } from './audit.model';

interface AuditRow {
  id: string;
  actor_id: string;
  actor_alias: string;
  action: AuditAction;
  entity_type: AuditEntityType;
  entity_id: string;
  reason: string | null;
  decision_kind: DecisionKind | null;
  created_at: string;
}

const SELECT_AUDIT = `
  SELECT a.*, u.alias AS actor_alias
  FROM audit_log a
  JOIN users u ON u.id = a.actor_id`;

function toEntry(row: AuditRow): AuditEntry {
  return {
    id: row.id,
    actorId: row.actor_id,
    actorAlias: row.actor_alias,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    reason: row.reason,
    decisionKind: row.decision_kind,
    createdAt: row.created_at,
  };
}

export const auditRepository = {
  findAll(action?: AuditAction): AuditEntry[] {
    if (action) {
      return db()
        .prepare<[string], AuditRow>(`${SELECT_AUDIT} WHERE a.action = ? ORDER BY a.created_at DESC, a.id`)
        .all(action)
        .map(toEntry);
    }
    return db().prepare<[], AuditRow>(`${SELECT_AUDIT} ORDER BY a.created_at DESC, a.id`).all().map(toEntry);
  },

  findById(id: string): AuditEntry | undefined {
    const row = db().prepare<[string], AuditRow>(`${SELECT_AUDIT} WHERE a.id = ?`).get(id);
    return row ? toEntry(row) : undefined;
  },

  insert(entry: NewAuditEntry): AuditEntry {
    db()
      .prepare(
        `INSERT INTO audit_log (id, actor_id, action, entity_type, entity_id, reason, decision_kind, created_at)
         VALUES (@id, @actorId, @action, @entityType, @entityId, @reason, @decisionKind, @createdAt)`,
      )
      .run(entry);
    const saved = this.findById(entry.id);
    if (!saved) throw new Error(`No se pudo leer la auditoría ${entry.id}`);
    return saved;
  },
};
