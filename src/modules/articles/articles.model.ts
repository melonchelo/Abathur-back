import type { ProposedArticle, Source } from '../../shared/content';

/** Versión publicada. Inmutable: nunca se reescribe ni se borra. */
export interface ArticleVersion {
  id: string;
  articleId: string;
  versionNumber: number;
  title: string;
  summary: string;
  /** Markdown tal como se publicó. */
  content: string;
  categoryId: string;
  tags: readonly string[];
  sources: readonly Source[];
  changeSummary: string;
  publishedBy: string;
  publishedByAlias: string;
  publishedAt: string;
  /** Propuesta que dio origen a la versión. `null` si la publicó el administrador directo. */
  proposalId: string | null;
  isCurrent: boolean;
}

export interface ArticleSummary {
  id: string;
  title: string;
  summary: string;
  categoryId: string;
  currentVersionId: string;
  currentVersionNumber: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  /** Verdadero si existe una propuesta del artículo que no está `aceptada` ni `rechazada`. */
  underReview: boolean;
}

export interface ArticleDetail extends ArticleSummary {
  currentVersion: ArticleVersion;
}

export interface CreateArticleRequest extends ProposedArticle {
  changeSummary?: string;
}

export interface ArticleFilters {
  /** Busca en título y resumen. */
  q?: string;
  /** Filtro exacto. */
  categoryId?: string;
}
