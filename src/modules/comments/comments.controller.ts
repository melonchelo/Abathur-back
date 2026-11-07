import type { Request, Response } from 'express';
import { notFound } from '../../shared/http-error';
import { newId, nowIso } from '../../shared/ids';
import { readBody, requiredString } from '../../shared/validation';
import { currentUser } from '../auth/auth.middleware';
import { proposalsRepository } from '../proposals/proposals.repository';
import type { Comment, CreateCommentRequest } from './comments.model';
import { commentsRepository } from './comments.repository';

function readCreateRequest(value: unknown): CreateCommentRequest {
  return { body: requiredString(readBody(value), 'body', 2000) };
}

function assertProposalExists(id: string): void {
  if (!proposalsRepository.findById(id)) {
    throw notFound('PROPOSAL_NOT_FOUND', 'La propuesta no existe.');
  }
}

export const commentsController = {
  /** GET /proposals/:id/comments */
  list(req: Request<{ id: string }>, res: Response<Comment[]>): void {
    assertProposalExists(req.params.id);
    res.json(commentsRepository.findByProposal(req.params.id));
  },

  /** POST /proposals/:id/comments · cliente y moderador */
  create(req: Request<{ id: string }>, res: Response<Comment>): void {
    const author = currentUser(req);
    const { body } = readCreateRequest(req.body);
    assertProposalExists(req.params.id);

    const id = newId();
    commentsRepository.insert({ id, proposalId: req.params.id, authorId: author.id, body, createdAt: nowIso() });

    const saved = commentsRepository.findById(id);
    if (!saved) throw new Error(`No se pudo leer el comentario ${id}`);
    res.status(201).json(saved);
  },
};
