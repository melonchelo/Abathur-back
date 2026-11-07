export interface Category {
  id: string;
  name: string;
  description: string | null;
  /** `null` en las categorías raíz. */
  parentId: string | null;
  createdAt: string;
}

export interface CreateCategoryRequest {
  name: string;
  description: string | null;
  parentId: string | null;
}

export interface UpdateCategoryRequest {
  name?: string;
  description?: string | null;
  parentId?: string | null;
}
