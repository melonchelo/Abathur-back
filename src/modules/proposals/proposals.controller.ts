import type { Request, Response } from 'express';
import { inTransaction } from '../../db/connection';
import { readProposedArticle } from '../../shared/content';
import { badRequest, conflict, notFound } from '../../shared/http-error';
import { newId, nowIso } from '../../shared/ids';
import {
  optionalBoolean,
  optionalString,
  queryString,
  readBody,
  requiredEnum,
} from '../../shared/validation';
import { publishNewArticle, publishNextVersion, type PublishResult } from '../articles/articles.publisher';
import { articlesRepository } from '../articles/articles.repository';
import { auditRepository } from '../audit/audit.repository';
import { currentUser } from '../auth/auth.middleware';
import { categoriesRepository } from '../categories/categories.repository';
import { REPUTATION_DELTA, type ReputationEvent } from '../reputation/reputation.model';
import { reputationRepository } from '../reputation/reputation.repository';
import { votesRepository } from '../votes/votes.repository';
import { QUORUM, resolveCommunityResult, tallyVotes } from '../votes/voting.policy';
import { classifyDecision, isReasonRequired } from './decision.policy';
import {
  DECISION_OUTCOMES,
  PROPOSAL_STATUSES,
  type CreateProposalRequest,
  type DecisionRequest,
  type DecisionResult,
  type Proposal,
} from './proposals.model';
import { proposalsRepository } from './proposals.repository';

function readCreateRequest(value: unknown): CreateProposalRequest {
  const body = readBody(value);
  const articleId = optionalString(body, 'articleId', 100) ?? null;
  const baseVersionId = optionalString(body, 'baseVersionId', 100) ?? null;
  if ((articleId === null) !== (baseVersionId === null)) {
    throw badRequest(
      'INVALID_PROPOSAL_TARGET',
      'Una modificación necesita articleId y baseVersionId. Una creación no lleva ninguno de los dos.',
    );
  }
  return { articleId, baseVersionId, proposed: readProposedArticle(body['proposed']) };
}

function readDecisionRequest(value: unknown): DecisionRequest {
  const body = readBody(value);
  return {
    outcome: requiredEnum(body, 'outcome', DECISION_OUTCOMES),
    reason: optionalString(body, 'reason', 2000) ?? null,
    markBaseAsError: optionalBoolean(body, 'markBaseAsError') ?? false,
  };
}

export function findProposalOr404(id: string): Proposal {
  const proposal = proposalsRepository.findById(id);
  if (!proposal) throw notFound('PROPOSAL_NOT_FOUND', 'La propuesta no existe.');
  return proposal;
}

const REASON_REQUIRED_MESSAGE = {
  apartada: 'El motivo es obligatorio: la decisión se aparta del resultado comunitario o hubo empate.',
  excepcional: 'El motivo es obligatorio: la propuesta se resuelve sin quórum, como decisión excepcional.',
} as const;

export const proposalsController = {
  /** GET /proposals?status=&articleId=&authorId= */
  list(req: Request, res: Response<Proposal[]>): void {
    const requestedStatus = queryString(req.query['status']);
    res.json(
      proposalsRepository.findAll({
        status: PROPOSAL_STATUSES.find((status) => status === requestedStatus),
        articleId: queryString(req.query['articleId']),
        authorId: queryString(req.query['authorId']),
      }),
    );
  },

  /** GET /proposals/:id */
  getById(req: Request<{ id: string }>, res: Response<Proposal>): void {
    res.json(findProposalOr404(req.params.id));
  },

  /** POST /proposals · cliente y moderador. Arranca en `abierta`. */
  create(req: Request, res: Response<Proposal>): void {
    const author = currentUser(req);
    const request = readCreateRequest(req.body);

    if (!categoriesRepository.findById(request.proposed.categoryId)) {
      throw badRequest('CATEGORY_NOT_FOUND', 'La categoría indicada no existe.');
    }
    if (request.articleId !== null && request.baseVersionId !== null) {
      if (!articlesRepository.findById(request.articleId)) {
        throw badRequest('ARTICLE_NOT_FOUND', 'El artículo a modificar no existe.');
      }
      const baseVersion = articlesRepository.findVersion(request.baseVersionId);
      if (!baseVersion || baseVersion.articleId !== request.articleId) {
        throw badRequest('BASE_VERSION_MISMATCH', 'La versión de base no pertenece a ese artículo.');
      }
    }

    const id = newId();
    proposalsRepository.insert({
      id,
      kind: request.articleId === null ? 'creacion' : 'modificacion',
      articleId: request.articleId,
      baseVersionId: request.baseVersionId,
      authorId: author.id,
      proposed: request.proposed,
      status: 'abierta',
      createdAt: nowIso(),
    });

    res.status(201).json(findProposalOr404(id));
  },

  /** POST /proposals/:id/voting · moderador o admin. `abierta` → `en_votacion`. */
  openVoting(req: Request<{ id: string }>, res: Response<Proposal>): void {
    const proposal = findProposalOr404(req.params.id);
    if (proposal.status !== 'abierta') {
      throw conflict('PROPOSAL_NOT_OPEN', `Solo se abre la votación de una propuesta abierta. Estado actual: ${proposal.status}.`);
    }
    proposalsRepository.openVoting(proposal.id, nowIso());
    res.json(findProposalOr404(proposal.id));
  },

  /**
   * POST /proposals/:id/close · moderador o admin. Exige quórum. Deja el
   * resultado comunitario; el artículo publicado no cambia.
   */
  closeVoting(req: Request<{ id: string }>, res: Response<Proposal>): void {
    const proposal = findProposalOr404(req.params.id);
    if (proposal.status !== 'en_votacion') {
      throw conflict('PROPOSAL_NOT_IN_VOTING', `La propuesta no está en votación. Estado actual: ${proposal.status}.`);
    }

    const tally = tallyVotes(votesRepository.findByProposal(proposal.id));
    if (!tally.quorum) {
      throw conflict('QUORUM_NOT_MET', `Hacen falta ${QUORUM} votos para cerrar. Hay ${tally.votes}.`);
    }

    proposalsRepository.closeVoting(proposal.id, resolveCommunityResult(tally.favor, tally.contra), nowIso());
    res.json(findProposalOr404(proposal.id));
  },

  /** POST /proposals/:id/decision · solo admin. */
  decide(req: Request<{ id: string }>, res: Response<DecisionResult>): void {
    const admin = currentUser(req);
    const proposal = findProposalOr404(req.params.id);
    const request = readDecisionRequest(req.body);

    if (proposal.status === 'aceptada' || proposal.status === 'rechazada') {
      throw conflict('PROPOSAL_ALREADY_DECIDED', 'La propuesta ya tiene una decisión.');
    }
    if (proposal.status === 'en_votacion' && proposal.tally.quorum) {
      throw conflict('VOTING_NOT_CLOSED', 'La votación ya tiene quórum: cerrala antes de decidir.');
    }
    if (request.markBaseAsError && (request.outcome !== 'aceptar' || proposal.kind !== 'modificacion')) {
      throw badRequest('MARK_ERROR_NOT_ALLOWED', 'Solo se marca el contenido anterior como error al aceptar una modificación.');
    }

    const kind = classifyDecision(proposal.communityResult, request.outcome);
    if (isReasonRequired(kind) && request.reason === null) {
      throw badRequest('REASON_REQUIRED', REASON_REQUIRED_MESSAGE[kind]);
    }

    const decidedAt = nowIso();
    const outcome = inTransaction(() => {
      const audit = auditRepository.insert({
        id: newId(),
        actorId: admin.id,
        action: 'decision_propuesta',
        entityType: 'proposal',
        entityId: proposal.id,
        reason: request.reason,
        decisionKind: kind,
        createdAt: decidedAt,
      });

      const reputationEvents: ReputationEvent[] = [];
      let published: PublishResult | null = null;

      if (request.outcome === 'aceptar') {
        const options = {
          publishedBy: proposal.authorId,
          changeSummary: `Propuesta aceptada: ${proposal.proposed.title}`,
          proposalId: proposal.id,
        };
        published =
          proposal.articleId === null
            ? publishNewArticle(proposal.proposed, options)
            : publishNextVersion(proposal.articleId, proposal.proposed, options);

        reputationEvents.push(
          reputationRepository.insert({
            id: newId(),
            userId: proposal.authorId,
            eventType: 'aporte_respaldado',
            sourceId: proposal.id,
            delta: REPUTATION_DELTA.aporte_respaldado,
            createdAt: decidedAt,
          }),
        );

        if (request.markBaseAsError && proposal.baseVersionId !== null) {
          const baseVersion = articlesRepository.findVersion(proposal.baseVersionId);
          if (!baseVersion) throw notFound('VERSION_NOT_FOUND', 'La versión de base ya no existe.');
          reputationEvents.push(
            reputationRepository.insert({
              id: newId(),
              userId: baseVersion.publishedBy,
              eventType: 'error_comprobado',
              sourceId: proposal.id,
              delta: REPUTATION_DELTA.error_comprobado,
              createdAt: decidedAt,
            }),
          );
        }
      }

      proposalsRepository.saveDecision(proposal.id, {
        status: request.outcome === 'aceptar' ? 'aceptada' : 'rechazada',
        outcome: request.outcome,
        kind,
        reason: request.reason,
        markedBaseAsError: request.markBaseAsError,
        decidedBy: admin.id,
        decidedAt,
        publishedArticleId: published?.articleId ?? null,
        publishedVersionId: published?.versionId ?? null,
      });

      return { audit, reputationEvents, published };
    });

    res.json({
      proposal: findProposalOr404(proposal.id),
      article: outcome.published ? (articlesRepository.findDetail(outcome.published.articleId) ?? null) : null,
      reputationEvents: outcome.reputationEvents,
      audit: outcome.audit,
    });
  },
};
