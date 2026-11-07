import type { ProposedArticle } from '../../shared/content';
import type { ArticleDetail } from '../articles/articles.model';
import type { AuditEntry, DecisionKind } from '../audit/audit.model';
import type { ReputationEvent } from '../reputation/reputation.model';
import type { VoteTally } from '../votes/votes.model';

export type ProposalStatus =
  | 'abierta'
  | 'en_votacion'
  | 'recomendada'
  | 'desaconsejada'
  | 'controvertida'
  | 'aceptada'
  | 'rechazada';

export const PROPOSAL_STATUSES: readonly ProposalStatus[] = [
  'abierta',
  'en_votacion',
  'recomendada',
  'desaconsejada',
  'controvertida',
  'aceptada',
  'rechazada',
];

/** `creacion` no tiene artículo ni versión de base. `modificacion` tiene los dos. */
export type ProposalKind = 'creacion' | 'modificacion';

/** Resultado del cierre comunitario. No publica ni cambia el artículo. */
export type CommunityResult = 'recomendada' | 'desaconsejada' | 'controvertida';

export type DecisionOutcome = 'aceptar' | 'rechazar';

export const DECISION_OUTCOMES: readonly DecisionOutcome[] = ['aceptar', 'rechazar'];

export interface ProposalDecision {
  outcome: DecisionOutcome;
  kind: DecisionKind;
  reason: string | null;
  markedBaseAsError: boolean;
  decidedBy: string;
  decidedByAlias: string;
  decidedAt: string;
  /** Solo si se aceptó: artículo y versión que nacieron de la propuesta. */
  publishedArticleId: string | null;
  publishedVersionId: string | null;
}

export interface Proposal {
  id: string;
  kind: ProposalKind;
  articleId: string | null;
  baseVersionId: string | null;
  authorId: string;
  authorAlias: string;
  proposed: ProposedArticle;
  status: ProposalStatus;
  /** `null` mientras no se cerró la votación con quórum. */
  communityResult: CommunityResult | null;
  tally: VoteTally;
  votingOpenedAt: string | null;
  votingClosedAt: string | null;
  decision: ProposalDecision | null;
  createdAt: string;
}

export interface CreateProposalRequest {
  /** `null` en una propuesta de creación. */
  articleId: string | null;
  /** Obligatorio si hay `articleId`. */
  baseVersionId: string | null;
  proposed: ProposedArticle;
}

export interface DecisionRequest {
  outcome: DecisionOutcome;
  reason: string | null;
  /** Solo en una modificación aceptada: el contenido anterior era un error. */
  markBaseAsError: boolean;
}

export interface DecisionResult {
  proposal: Proposal;
  /** Artículo tal como quedó después de aceptar. `null` si se rechazó. */
  article: ArticleDetail | null;
  /** Eventos creados por la decisión, para actualizar el puntaje sin recargar. */
  reputationEvents: readonly ReputationEvent[];
  audit: AuditEntry;
}

export interface ProposalFilters {
  status?: ProposalStatus;
  articleId?: string;
  authorId?: string;
}
