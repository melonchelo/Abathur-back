import type { CommunityResult } from '../proposals/proposals.model';
import type { VoteChoice, VoteTally } from './votes.model';

export const QUORUM = 3;

/** Misma cuenta que `VoteTallyStore` en el front. */
export function tallyVotes(votes: readonly { choice: VoteChoice; weightAtVote: number }[]): VoteTally {
  const sum = (choice: VoteChoice): number =>
    votes.filter((vote) => vote.choice === choice).reduce((total, vote) => total + vote.weightAtVote, 0);
  return {
    votes: votes.length,
    favor: sum('a_favor'),
    contra: sum('en_contra'),
    quorum: votes.length >= QUORUM,
  };
}

/** Más peso a favor: recomendada. Más peso en contra: desaconsejada. Empate: controvertida. */
export function resolveCommunityResult(favor: number, contra: number): CommunityResult {
  if (favor > contra) return 'recomendada';
  if (contra > favor) return 'desaconsejada';
  return 'controvertida';
}
