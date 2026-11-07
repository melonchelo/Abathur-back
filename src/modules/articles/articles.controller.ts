import type { Request, Response } from 'express';
import { inTransaction } from '../../db/connection';
import { readProposedArticle } from '../../shared/content';
import { badRequest, notFound } from '../../shared/http-error';
import { optionalString, queryString, readBody } from '../../shared/validation';
import { currentUser } from '../auth/auth.middleware';
import { categoriesRepository } from '../categories/categories.repository';
import type { ArticleDetail, ArticleSummary, ArticleVersion, CreateArticleRequest } from './articles.model';
import { publishNewArticle } from './articles.publisher';
import { articlesRepository } from './articles.repository';

function readCreateRequest(value: unknown): CreateArticleRequest {
  const body = readBody(value);
  return {
    ...readProposedArticle(body),
    changeSummary: optionalString(body, 'changeSummary', 500) ?? undefined,
  };
}

function findDetailOr404(articleId: string): ArticleDetail {
  const detail = articlesRepository.findDetail(articleId);
  if (!detail) throw notFound('ARTICLE_NOT_FOUND', 'El artículo no existe.');
  return detail;
}

export const articlesController = {
  /** GET /articles?q=&categoryId= */
  list(req: Request, res: Response<ArticleSummary[]>): void {
    res.json(
      articlesRepository.findAll({
        q: queryString(req.query['q']),
        categoryId: queryString(req.query['categoryId']),
      }),
    );
  },

  /** GET /articles/:id */
  getById(req: Request<{ id: string }>, res: Response<ArticleDetail>): void {
    res.json(findDetailOr404(req.params.id));
  },

  /** GET /articles/:id/versions · de la más nueva a la más vieja */
  listVersions(req: Request<{ id: string }>, res: Response<ArticleVersion[]>): void {
    findDetailOr404(req.params.id);
    res.json(articlesRepository.findVersions(req.params.id));
  },

  /** GET /articles/:id/versions/:versionId */
  getVersion(req: Request<{ id: string; versionId: string }>, res: Response<ArticleVersion>): void {
    const version = articlesRepository.findVersion(req.params.versionId);
    if (!version || version.articleId !== req.params.id) {
      throw notFound('VERSION_NOT_FOUND', 'La versión no existe en este artículo.');
    }
    res.json(version);
  },

  /** POST /articles · solo admin. Crea el artículo y su versión 1. */
  create(req: Request, res: Response<ArticleDetail>): void {
    const admin = currentUser(req);
    const request = readCreateRequest(req.body);
    if (!categoriesRepository.findById(request.categoryId)) {
      throw badRequest('CATEGORY_NOT_FOUND', 'La categoría indicada no existe.');
    }

    const { articleId } = inTransaction(() =>
      publishNewArticle(request, {
        publishedBy: admin.id,
        changeSummary: request.changeSummary ?? 'Versión inicial',
        proposalId: null,
      }),
    );

    res.status(201).json(findDetailOr404(articleId));
  },
};
