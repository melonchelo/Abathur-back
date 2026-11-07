export type AuditAction = 'decision_propuesta' | 'alta_usuario' | 'cambio_usuario' | 'conducta_abusiva';

export type AuditEntityType = 'proposal' | 'user';

/**
 * Cómo se relaciona la decisión del administrador con el resultado comunitario.
 * - `acorde`: coincide con `recomendada` o `desaconsejada`, con quórum.
 * - `apartada`: se aparta del resultado, o el resultado fue `controvertida`.
 * - `excepcional`: se resolvió sin quórum.
 */
export type DecisionKind = 'acorde' | 'apartada' | 'excepcional';

export const AUDIT_ACTIONS: readonly AuditAction[] = ['decision_propuesta', 'alta_usuario', 'cambio_usuario', 'conducta_abusiva'];

export interface AuditEntry {
  id: string;
  actorId: string;
  actorAlias: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  reason: string | null;
  /** Solo en `decision_propuesta`. */
  decisionKind: DecisionKind | null;
  createdAt: string;
}

export interface NewAuditEntry {
  id: string;
  actorId: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  reason: string | null;
  decisionKind: DecisionKind | null;
  createdAt: string;
}
