import type { Request, Response } from 'express';
import { conflict, notFound } from '../../shared/http-error';
import { newId, nowIso } from '../../shared/ids';
import { readBody, requiredEnum } from '../../shared/validation';
import { currentUser } from '../auth/auth.middleware';
import { proposalsRepository } from '../proposals/proposals.repository';
import { voteWeight } from '../reputation/reputation.policy';
import { VOTE_CHOICES, type CastVoteRequest, type Vote } from './votes.model';
import { votesRepository } from './votes.repository';

function readCastVoteRequest(value: unknown): CastVoteRequest {
  return { choice: requiredEnum(readBody(value), 'choice', VOTE_CHOICES) };
}

export const votesController = {
  /** GET /proposals/:id/votes */
  list(req: Request<{ id: string }>, res: Response<Vote[]>): void {
    if (!proposalsRepository.findById(req.params.id)) {
      throw notFound('PROPOSAL_NOT_FOUND', 'La propuesta no existe.');
    }
    res.json(votesRepository.findByProposal(req.params.id));
  },

  /**
   * POST /proposals/:id/votes · solo moderador, con la propuesta `en_votacion`.
   * El peso sale de la reputación actual del moderador y queda congelado en `weightAtVote`.
   */
  cast(req: Request<{ id: string }>, res: Response<Vote>): void {
    const moderator = currentUser(req);
    const { choice } = readCastVoteRequest(req.body);

    const proposal = proposalsRepository.findById(req.params.id);
    if (!proposal) throw notFound('PROPOSAL_NOT_FOUND', 'La propuesta no existe.');
    if (proposal.status !== 'en_votacion') {
      throw conflict('PROPOSAL_NOT_IN_VOTING', `La propuesta no está en votación. Estado actual: ${proposal.status}.`);
    }
    if (votesRepository.hasVoted(proposal.id, moderator.id)) {
      throw conflict('ALREADY_VOTED', 'Ya votaste esta propuesta. El voto no se edita.');
    }

    const id = newId();
    votesRepository.insert({
      id,
      proposalId: proposal.id,
      moderatorId: moderator.id,
      choice,
      weightAtVote: voteWeight(moderator.reputation),
      createdAt: nowIso(),
    });

    const saved = votesRepository.findById(id);
    if (!saved) throw new Error(`No se pudo leer el voto ${id}`);
    res.status(201).json(saved);
  },
};
