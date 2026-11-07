export type VoteChoice = 'a_favor' | 'en_contra';

export const VOTE_CHOICES: readonly VoteChoice[] = ['a_favor', 'en_contra'];

export interface Vote {
  id: string;
  proposalId: string;
  moderatorId: string;
  moderatorAlias: string;
  choice: VoteChoice;
  /** Peso calculado por el servidor al guardar el voto. No cambia después. */
  weightAtVote: number;
  createdAt: string;
}

/** El cliente solo elige. Si manda un peso, se ignora. */
export interface CastVoteRequest {
  choice: VoteChoice;
}

export interface VoteTally {
  votes: number;
  favor: number;
  contra: number;
  quorum: boolean;
}
