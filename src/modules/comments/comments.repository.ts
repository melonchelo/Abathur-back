import { db } from '../../db/connection';
import type { Comment } from './comments.model';

interface CommentRow {
  id: string;
  proposal_id: string;
  author_id: string;
  author_alias: string;
  body: string;
  created_at: string;
}

export interface NewCommentRow {
  id: string;
  proposalId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

const SELECT_COMMENT = `
  SELECT c.*, u.alias AS author_alias
  FROM comments c
  JOIN users u ON u.id = c.author_id`;

function toComment(row: CommentRow): Comment {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    authorId: row.author_id,
    authorAlias: row.author_alias,
    body: row.body,
    createdAt: row.created_at,
  };
}

export const commentsRepository = {
  findByProposal(proposalId: string): Comment[] {
    return db()
      .prepare<[string], CommentRow>(`${SELECT_COMMENT} WHERE c.proposal_id = ? ORDER BY c.created_at, c.id`)
      .all(proposalId)
      .map(toComment);
  },

  findById(id: string): Comment | undefined {
    const row = db().prepare<[string], CommentRow>(`${SELECT_COMMENT} WHERE c.id = ?`).get(id);
    return row ? toComment(row) : undefined;
  },

  insert(comment: NewCommentRow): void {
    db()
      .prepare(
        `INSERT INTO comments (id, proposal_id, author_id, body, created_at)
         VALUES (@id, @proposalId, @authorId, @body, @createdAt)`,
      )
      .run(comment);
  },
};
