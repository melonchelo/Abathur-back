import { db } from '../../db/connection';
import type { Category } from './categories.model';

interface CategoryRow {
  id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  created_at: string;
}

function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    parentId: row.parent_id,
    createdAt: row.created_at,
  };
}

export const categoriesRepository = {
  findAll(): Category[] {
    return db().prepare<[], CategoryRow>('SELECT * FROM categories ORDER BY name').all().map(toCategory);
  },

  findById(id: string): Category | undefined {
    const row = db().prepare<[string], CategoryRow>('SELECT * FROM categories WHERE id = ?').get(id);
    return row ? toCategory(row) : undefined;
  },

  insert(category: Category): void {
    db()
      .prepare(
        `INSERT INTO categories (id, name, description, parent_id, created_at)
         VALUES (@id, @name, @description, @parentId, @createdAt)`,
      )
      .run(category);
  },

  update(category: Category): void {
    db()
      .prepare('UPDATE categories SET name = @name, description = @description, parent_id = @parentId WHERE id = @id')
      .run({ id: category.id, name: category.name, description: category.description, parentId: category.parentId });
  },
};
