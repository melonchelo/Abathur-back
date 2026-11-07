import { db } from '../../db/connection';
import type { Vote, VoteChoice } from './votes.model';

interface VoteRow {
  id: string;
  proposal_id: string;
  moderator_id: string;
  moderator_alias: string;
  choice: VoteChoice;
  weight_at_vote: number;
  created_at: string;
}

export interface NewVoteRow {
  id: string;
  proposalId: string;
  moderatorId: string;
  choice: VoteChoice;
  weightAtVote: number;
  createdAt: string;
}

const SELECT_VOTE = `
  SELECT v.*, u.alias AS moderator_alias
  FROM votes v
  JOIN users u ON u.id = v.moderator_id`;

function toVote(row: VoteRow): Vote {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    moderatorId: row.moderator_id,
    moderatorAlias: row.moderator_alias,
    choice: row.choice,
    weightAtVote: row.weight_at_vote,
    createdAt: row.created_at,
  };
}

export const votesRepository = {
  findByProposal(proposalId: string): Vote[] {
    return db()
      .prepare<[string], VoteRow>(`${SELECT_VOTE} WHERE v.proposal_id = ? ORDER BY v.created_at, v.id`)
      .all(proposalId)
      .map(toVote);
  },

  findById(id: string): Vote | undefined {
    const row = db().prepare<[string], VoteRow>(`${SELECT_VOTE} WHERE v.id = ?`).get(id);
    return row ? toVote(row) : undefined;
  },

  hasVoted(proposalId: string, moderatorId: string): boolean {
    const row = db()
      .prepare<[string, string], { found: 1 }>('SELECT 1 AS found FROM votes WHERE proposal_id = ? AND moderator_id = ?')
      .get(proposalId, moderatorId);
    return row !== undefined;
  },

  /** La restricción UNIQUE (proposal_id, moderator_id) garantiza un voto por moderador. */
  insert(vote: NewVoteRow): void {
    db()
      .prepare(
        `INSERT INTO votes (id, proposal_id, moderator_id, choice, weight_at_vote, created_at)
         VALUES (@id, @proposalId, @moderatorId, @choice, @weightAtVote, @createdAt)`,
      )
      .run(vote);
  },
};
