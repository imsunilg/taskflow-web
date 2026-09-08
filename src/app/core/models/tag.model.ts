export interface Tag {
  id: string;
  userId: string;
  name: string;
  taskCount?: number;
  createdAt: string;
}

export interface CreateTagRequest {
  name: string;
}
