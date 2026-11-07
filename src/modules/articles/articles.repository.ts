import { db } from '../../db/connection';
import { parseSources, parseTags, type Source } from '../../shared/content';
import type { ArticleDetail, ArticleFilters, ArticleSummary, ArticleVersion } from './articles.model';

interface ArticleRow {
  id: string;
  title: string;
  summary: string;
  category_id: string;
  current_version_id: string;
  current_version_number: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  under_review: 0 | 1;
}

interface VersionRow {
  id: string;
  article_id: string;
  version_number: number;
  title: string;
  summary: string;
  content: string;
  category_id: string;
  tags: string;
  sources: string;
  change_summary: string;
  published_by: string;
  published_by_alias: string;
  published_at: string;
  proposal_id: string | null;
  is_current: 0 | 1;
}

export interface NewArticleRow {
  id: string;
  title: string;
  summary: string;
  categoryId: string;
  createdBy: string;
  createdAt: string;
}

export interface NewVersionRow {
  id: string;
  articleId: string;
  versionNumber: number;
  title: string;
  summary: string;
  content: string;
  categoryId: string;
  tags: readonly string[];
  sources: readonly Source[];
  changeSummary: string;
  publishedBy: string;
  publishedAt: string;
  proposalId: string | null;
}

const SELECT_ARTICLE = `
  SELECT a.id, a.title, a.summary, a.category_id, a.current_version_id, a.created_by,
         a.created_at, a.updated_at, v.version_number AS current_version_number,
         EXISTS (
           SELECT 1 FROM proposals p
           WHERE p.article_id = a.id AND p.status NOT IN ('aceptada', 'rechazada')
         ) AS under_review
  FROM articles a
  JOIN article_versions v ON v.id = a.current_version_id`;

const SELECT_VERSION = `
  SELECT v.*, u.alias AS published_by_alias,
         (a.current_version_id = v.id) AS is_current
  FROM article_versions v
  JOIN users u ON u.id = v.published_by
  JOIN articles a ON a.id = v.article_id`;

function toSummary(row: ArticleRow): ArticleSummary {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    categoryId: row.category_id,
    currentVersionId: row.current_version_id,
    currentVersionNumber: row.current_version_number,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    underReview: row.under_review === 1,
  };
}

function toVersion(row: VersionRow): ArticleVersion {
  return {
    id: row.id,
    articleId: row.article_id,
    versionNumber: row.version_number,
    title: row.title,
    summary: row.summary,
    content: row.content,
    categoryId: row.category_id,
    tags: parseTags(row.tags),
    sources: parseSources(row.sources),
    changeSummary: row.change_summary,
    publishedBy: row.published_by,
    publishedByAlias: row.published_by_alias,
    publishedAt: row.published_at,
    proposalId: row.proposal_id,
    isCurrent: row.is_current === 1,
  };
}

export const articlesRepository = {
  findAll(filters: ArticleFilters): ArticleSummary[] {
    const conditions: string[] = [];
    const params: Record<string, string> = {};
    if (filters.q) {
      conditions.push(`(a.title LIKE @q ESCAPE '\\' OR a.summary LIKE @q ESCAPE '\\')`);
      params['q'] = `%${filters.q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
    }
    if (filters.categoryId) {
      conditions.push('a.category_id = @categoryId');
      params['categoryId'] = filters.categoryId;
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return db()
      .prepare<[Record<string, string>], ArticleRow>(`${SELECT_ARTICLE} ${where} ORDER BY a.title`)
      .all(params)
      .map(toSummary);
  },

  findById(id: string): ArticleSummary | undefined {
    const row = db().prepare<[string], ArticleRow>(`${SELECT_ARTICLE} WHERE a.id = ?`).get(id);
    return row ? toSummary(row) : undefined;
  },

  /** Artículo con su versión vigente completa. */
  findDetail(id: string): ArticleDetail | undefined {
    const article = this.findById(id);
    if (!article) return undefined;
    const currentVersion = this.findVersion(article.currentVersionId);
    return currentVersion ? { ...article, currentVersion } : undefined;
  },

  findVersions(articleId: string): ArticleVersion[] {
    return db()
      .prepare<[string], VersionRow>(`${SELECT_VERSION} WHERE v.article_id = ? ORDER BY v.version_number DESC`)
      .all(articleId)
      .map(toVersion);
  },

  findVersion(versionId: string): ArticleVersion | undefined {
    const row = db().prepare<[string], VersionRow>(`${SELECT_VERSION} WHERE v.id = ?`).get(versionId);
    return row ? toVersion(row) : undefined;
  },

  nextVersionNumber(articleId: string): number {
    const row = db()
      .prepare<[string], { last: number | null }>('SELECT MAX(version_number) AS last FROM article_versions WHERE article_id = ?')
      .get(articleId);
    return (row?.last ?? 0) + 1;
  },

  insertArticle(article: NewArticleRow): void {
    db()
      .prepare(
        `INSERT INTO articles (id, title, summary, category_id, current_version_id, created_by, created_at, updated_at)
         VALUES (@id, @title, @summary, @categoryId, NULL, @createdBy, @createdAt, @createdAt)`,
      )
      .run(article);
  },

  insertVersion(version: NewVersionRow): void {
    db()
      .prepare(
        `INSERT INTO article_versions (id, article_id, version_number, title, summary, content, category_id,
                                       tags, sources, change_summary, published_by, published_at, proposal_id)
         VALUES (@id, @articleId, @versionNumber, @title, @summary, @content, @categoryId,
                 @tags, @sources, @changeSummary, @publishedBy, @publishedAt, @proposalId)`,
      )
      .run({ ...version, tags: JSON.stringify(version.tags), sources: JSON.stringify(version.sources) });
  },

  /** Apunta el artículo a su versión vigente y copia los datos de cabecera de esa versión. */
  setCurrentVersion(version: NewVersionRow): void {
    db()
      .prepare(
        `UPDATE articles
         SET current_version_id = @id, title = @title, summary = @summary,
             category_id = @categoryId, updated_at = @publishedAt
         WHERE id = @articleId`,
      )
      .run({
        id: version.id,
        title: version.title,
        summary: version.summary,
        categoryId: version.categoryId,
        publishedAt: version.publishedAt,
        articleId: version.articleId,
      });
  },
};
