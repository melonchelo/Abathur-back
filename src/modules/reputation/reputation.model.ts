export type ReputationEventType = 'asignacion_inicial' | 'aporte_respaldado' | 'error_comprobado' | 'conducta_abusiva';

export interface ReputationEvent {
  id: string;
  userId: string;
  eventType: ReputationEventType;
  /** Origen del evento: usuario, propuesta o registro de auditoría según el tipo. */
  sourceId: string;
  delta: number;
  createdAt: string;
}

export interface ReputationSummary {
  userId: string;
  score: number;
  weight: number;
  events: readonly ReputationEvent[];
}

export const REPUTATION_DELTA = {
  aporte_respaldado: 5,
  error_comprobado: -5,
  conducta_abusiva: -8,
} as const;
