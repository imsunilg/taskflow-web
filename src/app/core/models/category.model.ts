export interface Category {
  id: string;
  userId: string;
  name: string;
  color: string;
  icon: string | null;
  taskCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryRequest {
  name: string;
  color: string;
  icon?: string | null;
}

export type UpdateCategoryRequest = Partial<CreateCategoryRequest>;
