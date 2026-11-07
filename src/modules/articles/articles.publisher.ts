import type { ProposedArticle } from '../../shared/content';
import { newId, nowIso } from '../../shared/ids';
import { articlesRepository, type NewVersionRow } from './articles.repository';

export interface PublishOptions {
  publishedBy: string;
  changeSummary: string;
  proposalId: string | null;
}

export interface PublishResult {
  articleId: string;
  versionId: string;
}

/**
 * Crea el artículo y su versión 1. Se llama dentro de una transacción.
 */
export function publishNewArticle(content: ProposedArticle, options: PublishOptions): PublishResult {
  const articleId = newId();
  const publishedAt = nowIso();
  articlesRepository.insertArticle({
    id: articleId,
    title: content.title,
    summary: content.summary,
    categoryId: content.categoryId,
    createdBy: options.publishedBy,
    createdAt: publishedAt,
  });
  return insertAndActivate(articleId, 1, content, options, publishedAt);
}

/**
 * Agrega una versión nueva al artículo. La anterior queda intacta en el historial
 * y `current_version_id` pasa a la nueva. Se llama dentro de una transacción.
 */
export function publishNextVersion(articleId: string, content: ProposedArticle, options: PublishOptions): PublishResult {
  const versionNumber = articlesRepository.nextVersionNumber(articleId);
  return insertAndActivate(articleId, versionNumber, content, options, nowIso());
}

function insertAndActivate(
  articleId: string,
  versionNumber: number,
  content: ProposedArticle,
  options: PublishOptions,
  publishedAt: string,
): PublishResult {
  const version: NewVersionRow = {
    id: newId(),
    articleId,
    versionNumber,
    title: content.title,
    summary: content.summary,
    content: content.content,
    categoryId: content.categoryId,
    tags: content.tags,
    sources: content.sources,
    changeSummary: options.changeSummary,
    publishedBy: options.publishedBy,
    publishedAt,
    proposalId: options.proposalId,
  };
  articlesRepository.insertVersion(version);
  articlesRepository.setCurrentVersion(version);
  return { articleId, versionId: version.id };
}
