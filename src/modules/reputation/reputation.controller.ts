import type { Request, Response } from 'express';
import { notFound } from '../../shared/http-error';
import { usersRepository } from '../users/users.repository';
import type { ReputationSummary } from './reputation.model';
import { voteWeight } from './reputation.policy';
import { reputationRepository } from './reputation.repository';

export const reputationController = {
  /** GET /users/:id/reputation */
  getByUser(req: Request<{ id: string }>, res: Response<ReputationSummary>): void {
    const user = usersRepository.findById(req.params.id);
    if (!user) throw notFound('USER_NOT_FOUND', 'La persona no existe.');

    res.json({
      userId: user.id,
      score: user.reputation,
      weight: voteWeight(user.reputation),
      events: reputationRepository.findByUser(user.id),
    });
  },
};
