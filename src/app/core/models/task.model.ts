export type Priority = 'Low' | 'Medium' | 'High' | 'Urgent';

export type RecurrenceFrequency =
  | 'Daily'
  | 'Weekdays'
  | 'Weekly'
  | 'Monthly'
  | 'Yearly'
  | 'Custom';

export interface Subtask {
  id: string;
  taskId: string;
  text: string;
  isDone: boolean;
  sortOrder: number;
}

export interface RecurrenceRule {
  id: string;
  frequency: RecurrenceFrequency;
  interval: number;
  daysOfWeek: number[] | null;
  dayOfMonth: number | null;
  until: string | null;
}

export interface Reminder {
  id: string;
  taskId: string;
  offsetMinutes: number;
  firesAt: string;
  deliveredAt: string | null;
}

export interface TaskHistoryEntry {
  id: string;
  taskId: string;
  changeText: string;
  changedAt: string;
  changedBy: string;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  dueTime: string | null;
  priority: Priority;
  categoryId: string | null;
  categoryName?: string | null;
  categoryColor?: string | null;
  completed: boolean;
  completedAt: string | null;
  important: boolean;
  notes: string | null;
  isVoiceCreated?: boolean;
  tags: string[];
  subtasks: Subtask[];
  reminder: Reminder | null;
  recurrenceRule: RecurrenceRule | null;
  history: TaskHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskRequest {
  title: string;
  description?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
  priority?: Priority;
  categoryId?: string | null;
  tagNames?: string[];
  subtaskTexts?: string[];
  reminderOffsetMinutes?: number | null;
  recurrenceFrequency?: RecurrenceFrequency | null;
  recurrenceInterval?: number | null;
  notes?: string | null;
}

export type UpdateTaskRequest = Partial<CreateTaskRequest> & {
  completed?: boolean;
  important?: boolean;
};

export interface CreateSubtaskRequest {
  text: string;
}

export interface UpdateSubtaskRequest {
  text?: string;
  isDone?: boolean;
  sortOrder?: number;
}

export type SortKey = 'due' | 'priority' | 'created' | 'alpha' | 'updated';
export type GroupKey = 'date' | 'category' | 'priority' | 'none';
export type TaskStatus = 'active' | 'completed' | 'overdue';

export interface FilterState {
  status?: TaskStatus[];
  priority?: Priority[];
  categoryId?: string[];
  tagIds?: string[];
  dueDate?: 'today' | 'this-week' | 'no-date';
  recurringOnly?: boolean;
  hasReminder?: boolean;
  search?: string;
}

export interface TaskQueryParams {
  page?: number;
  pageSize?: number;
  status?: string;
  priority?: string;
  categoryId?: string;
  tagIds?: string;
  dueDate?: string;
  search?: string;
  sort?: SortKey;
  groupBy?: GroupKey;
}
