import type { Request, Response } from 'express';
import { badRequest, notFound } from '../../shared/http-error';
import { newId, nowIso } from '../../shared/ids';
import { optionalString, readBody, requiredString } from '../../shared/validation';
import type { Category, CreateCategoryRequest, UpdateCategoryRequest } from './categories.model';
import { categoriesRepository } from './categories.repository';

function readCreateRequest(value: unknown): CreateCategoryRequest {
  const body = readBody(value);
  return {
    name: requiredString(body, 'name', 100),
    description: optionalString(body, 'description', 500) ?? null,
    parentId: optionalString(body, 'parentId', 100) ?? null,
  };
}

function readUpdateRequest(value: unknown): UpdateCategoryRequest {
  const body = readBody(value);
  return {
    name: body['name'] === undefined ? undefined : requiredString(body, 'name', 100),
    description: optionalString(body, 'description', 500),
    parentId: optionalString(body, 'parentId', 100),
  };
}

function findCategoryOr404(id: string): Category {
  const category = categoriesRepository.findById(id);
  if (!category) throw notFound('CATEGORY_NOT_FOUND', 'La categoría no existe.');
  return category;
}

/**
 * Sube desde el padre propuesto hasta la raíz. Si en el camino aparece la
 * propia categoría, el cambio formaría un ciclo.
 */
function assertValidParent(categoryId: string, parentId: string | null): void {
  if (parentId === null) return;
  if (parentId === categoryId) {
    throw badRequest('CATEGORY_SELF_PARENT', 'Una categoría no puede ser su propio padre.');
  }
  findCategoryOr404(parentId);

  const visited = new Set<string>();
  let current: string | null = parentId;
  while (current !== null) {
    if (current === categoryId || visited.has(current)) {
      throw badRequest('CATEGORY_CYCLE', 'Ese padre formaría un ciclo en el árbol de categorías.');
    }
    visited.add(current);
    current = categoriesRepository.findById(current)?.parentId ?? null;
  }
}

export const categoriesController = {
  /** GET /categories */
  list(_req: Request, res: Response<Category[]>): void {
    res.json(categoriesRepository.findAll());
  },

  /** GET /categories/:id */
  getById(req: Request<{ id: string }>, res: Response<Category>): void {
    res.json(findCategoryOr404(req.params.id));
  },

  /** POST /categories · solo admin */
  create(req: Request, res: Response<Category>): void {
    const request = readCreateRequest(req.body);
    const category: Category = { id: newId(), ...request, createdAt: nowIso() };
    assertValidParent(category.id, category.parentId);

    categoriesRepository.insert(category);
    res.status(201).json(category);
  },

  /** PATCH /categories/:id · solo admin */
  update(req: Request<{ id: string }>, res: Response<Category>): void {
    const current = findCategoryOr404(req.params.id);
    const request = readUpdateRequest(req.body);
    const updated: Category = {
      ...current,
      name: request.name ?? current.name,
      description: request.description === undefined ? current.description : request.description,
      parentId: request.parentId === undefined ? current.parentId : request.parentId,
    };
    assertValidParent(updated.id, updated.parentId);

    categoriesRepository.update(updated);
    res.json(updated);
  },
};
