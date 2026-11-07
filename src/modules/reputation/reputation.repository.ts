import { db } from '../../db/connection';
import type { ReputationEvent, ReputationEventType } from './reputation.model';

interface ReputationEventRow {
  id: string;
  user_id: string;
  event_type: ReputationEventType;
  source_id: string;
  delta: number;
  created_at: string;
}

function toEvent(row: ReputationEventRow): ReputationEvent {
  return {
    id: row.id,
    userId: row.user_id,
    eventType: row.event_type,
    sourceId: row.source_id,
    delta: row.delta,
    createdAt: row.created_at,
  };
}

export const reputationRepository = {
  findByUser(userId: string): ReputationEvent[] {
    return db()
      .prepare<[string], ReputationEventRow>('SELECT * FROM reputation_events WHERE user_id = ? ORDER BY created_at, id')
      .all(userId)
      .map(toEvent);
  },

  exists(userId: string, eventType: ReputationEventType, sourceId: string): boolean {
    const row = db()
      .prepare<[string, string, string], { found: 1 }>(
        'SELECT 1 AS found FROM reputation_events WHERE user_id = ? AND event_type = ? AND source_id = ?',
      )
      .get(userId, eventType, sourceId);
    return row !== undefined;
  },

  /** La restricción UNIQUE (user_id, event_type, source_id) impide aplicar dos veces el mismo evento. */
  insert(event: ReputationEvent): ReputationEvent {
    db()
      .prepare(
        `INSERT INTO reputation_events (id, user_id, event_type, source_id, delta, created_at)
         VALUES (@id, @userId, @eventType, @sourceId, @delta, @createdAt)`,
      )
      .run(event);
    return event;
  },
};
