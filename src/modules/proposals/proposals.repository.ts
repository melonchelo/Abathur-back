import { db } from '../../db/connection';
import { parseSources, parseTags, type ProposedArticle } from '../../shared/content';
import type { DecisionKind } from '../audit/audit.model';
import { QUORUM } from '../votes/voting.policy';
import type {
  CommunityResult,
  DecisionOutcome,
  Proposal,
  ProposalFilters,
  ProposalKind,
  ProposalStatus,
} from './proposals.model';

interface ProposalRow {
  id: string;
  kind: ProposalKind;
  article_id: string | null;
  base_version_id: string | null;
  author_id: string;
  author_alias: string;
  title: string;
  summary: string;
  content: string;
  category_id: string;
  tags: string;
  sources: string;
  status: ProposalStatus;
  community_result: CommunityResult | null;
  voting_opened_at: string | null;
  voting_closed_at: string | null;
  decision_outcome: DecisionOutcome | null;
  decision_kind: DecisionKind | null;
  decision_reason: string | null;
  marked_base_as_error: 0 | 1;
  decided_by: string | null;
  decided_by_alias: string | null;
  decided_at: string | null;
  published_article_id: string | null;
  published_version_id: string | null;
  created_at: string;
  vote_count: number;
  favor: number;
  contra: number;
}

export interface NewProposalRow {
  id: string;
  kind: ProposalKind;
  articleId: string | null;
  baseVersionId: string | null;
  authorId: string;
  proposed: ProposedArticle;
  status: ProposalStatus;
  createdAt: string;
}

export interface DecisionRow {
  status: 'aceptada' | 'rechazada';
  outcome: DecisionOutcome;
  kind: DecisionKind;
  reason: string | null;
  markedBaseAsError: boolean;
  decidedBy: string;
  decidedAt: string;
  publishedArticleId: string | null;
  publishedVersionId: string | null;
}

const SELECT_PROPOSAL = `
  SELECT p.*, author.alias AS author_alias, decider.alias AS decided_by_alias,
         (SELECT COUNT(*) FROM votes v WHERE v.proposal_id = p.id) AS vote_count,
         (SELECT COALESCE(SUM(v.weight_at_vote), 0) FROM votes v
           WHERE v.proposal_id = p.id AND v.choice = 'a_favor') AS favor,
         (SELECT COALESCE(SUM(v.weight_at_vote), 0) FROM votes v
           WHERE v.proposal_id = p.id AND v.choice = 'en_contra') AS contra
  FROM proposals p
  JOIN users author ON author.id = p.author_id
  LEFT JOIN users decider ON decider.id = p.decided_by`;

function toProposal(row: ProposalRow): Proposal {
  return {
    id: row.id,
    kind: row.kind,
    articleId: row.article_id,
    baseVersionId: row.base_version_id,
    authorId: row.author_id,
    authorAlias: row.author_alias,
    proposed: {
      title: row.title,
      summary: row.summary,
      content: row.content,
      categoryId: row.category_id,
      tags: parseTags(row.tags),
      sources: parseSources(row.sources),
    },
    status: row.status,
    communityResult: row.community_result,
    tally: {
      votes: row.vote_count,
      favor: row.favor,
      contra: row.contra,
      quorum: row.vote_count >= QUORUM,
    },
    votingOpenedAt: row.voting_opened_at,
    votingClosedAt: row.voting_closed_at,
    decision:
      row.decision_outcome && row.decision_kind && row.decided_by && row.decided_at
        ? {
            outcome: row.decision_outcome,
            kind: row.decision_kind,
            reason: row.decision_reason,
            markedBaseAsError: row.marked_base_as_error === 1,
            decidedBy: row.decided_by,
            decidedByAlias: row.decided_by_alias ?? '',
            decidedAt: row.decided_at,
            publishedArticleId: row.published_article_id,
            publishedVersionId: row.published_version_id,
          }
        : null,
    createdAt: row.created_at,
  };
}

export const proposalsRepository = {
  findAll(filters: ProposalFilters): Proposal[] {
    const conditions: string[] = [];
    const params: Record<string, string> = {};
    if (filters.status) {
      conditions.push('p.status = @status');
      params['status'] = filters.status;
    }
    if (filters.articleId) {
      conditions.push('p.article_id = @articleId');
      params['articleId'] = filters.articleId;
    }
    if (filters.authorId) {
      conditions.push('p.author_id = @authorId');
      params['authorId'] = filters.authorId;
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return db()
      .prepare<[Record<string, string>], ProposalRow>(`${SELECT_PROPOSAL} ${where} ORDER BY p.created_at DESC, p.id`)
      .all(params)
      .map(toProposal);
  },

  findById(id: string): Proposal | undefined {
    const row = db().prepare<[string], ProposalRow>(`${SELECT_PROPOSAL} WHERE p.id = ?`).get(id);
    return row ? toProposal(row) : undefined;
  },

  insert(proposal: NewProposalRow): void {
    db()
      .prepare(
        `INSERT INTO proposals (id, kind, article_id, base_version_id, author_id, title, summary, content,
                                category_id, tags, sources, status, created_at)
         VALUES (@id, @kind, @articleId, @baseVersionId, @authorId, @title, @summary, @content,
                 @categoryId, @tags, @sources, @status, @createdAt)`,
      )
      .run({
        id: proposal.id,
        kind: proposal.kind,
        articleId: proposal.articleId,
        baseVersionId: proposal.baseVersionId,
        authorId: proposal.authorId,
        title: proposal.proposed.title,
        summary: proposal.proposed.summary,
        content: proposal.proposed.content,
        categoryId: proposal.proposed.categoryId,
        tags: JSON.stringify(proposal.proposed.tags),
        sources: JSON.stringify(proposal.proposed.sources),
        status: proposal.status,
        createdAt: proposal.createdAt,
      });
  },

  openVoting(id: string, openedAt: string): void {
    db()
      .prepare(`UPDATE proposals SET status = 'en_votacion', voting_opened_at = ? WHERE id = ?`)
      .run(openedAt, id);
  },

  closeVoting(id: string, result: CommunityResult, closedAt: string): void {
    db()
      .prepare('UPDATE proposals SET status = @result, community_result = @result, voting_closed_at = @closedAt WHERE id = @id')
      .run({ id, result, closedAt });
  },

  saveDecision(id: string, decision: DecisionRow): void {
    db()
      .prepare(
        `UPDATE proposals
         SET status = @status, decision_outcome = @outcome, decision_kind = @kind, decision_reason = @reason,
             marked_base_as_error = @markedBaseAsError, decided_by = @decidedBy, decided_at = @decidedAt,
             published_article_id = @publishedArticleId, published_version_id = @publishedVersionId
         WHERE id = @id`,
      )
      .run({ id, ...decision, markedBaseAsError: decision.markedBaseAsError ? 1 : 0 });
  },
};
