export interface AiConfig {
  configured: boolean;
  model: string;
}

export interface TaskDraft {
  title: string;
  description: string | null;
  dueDate: string | null; // yyyy-MM-dd
  dueTime: string | null; // HH:mm:ss
  priority: 'Low' | 'Medium' | 'High' | 'Urgent' | null;
  category: string | null;
  tags: string[];
}

export interface TaskAnalysis {
  priority: string;
  estimatedEffort: string;
  complexity: string;
  suggestedDeadline: string;
  suggestedTags: string[];
  potentialBlocker: string;
  recommendedNextAction: string;
}

export interface SubtaskNode {
  title: string;
}

export interface SubtaskTree {
  subtasks: SubtaskNode[];
}

export interface TaskSummary {
  id: string;
  title: string;
  priority: string;
  dueDate: string | null;
  dueTime: string | null;
  completed: boolean;
  important: boolean;
  categoryName: string | null;
  subtaskCount: number;
  subtaskDoneCount: number;
  hasRecurrence: boolean;
}

export interface PlanBlock {
  taskId: string;
  title: string;
  priority: string;
  start: string;
  end: string;
  reason: string;
}

export interface DailyPlan {
  date: string;
  blocks: PlanBlock[];
}

export interface NextTaskRecommendation {
  taskId: string;
  title: string;
  reasons: string[];
  suggestedAction: string;
}

export interface DailyStats {
  completed: number;
  remaining: number;
  overdue: number;
  completionRate: number;
  highPriorityCompleted: number;
}

export interface DailySummary {
  stats: DailyStats;
  insight: string;
}

export interface SearchFilter {
  status: string | null;
  priority: string[] | null;
  category: string | null;
  due: string | null;
  search: string | null;
}

export interface NlSearchResult {
  filter: SearchFilter;
  results: TaskSummary[];
}

export type AssistantPreviewKind = 'create_task' | 'reschedule' | 'generic' | null;

export interface CreateTaskPreview {
  task: TaskDraft;
}

export interface RescheduleChange {
  taskId: string;
  title: string;
  from: string;
  to: string;
}

export interface ReschedulePreview {
  changes: RescheduleChange[];
}

export interface GenericActionPreview {
  toolName: string;
  summary: string;
}

export interface AssistantTurn {
  reply: string;
  toolName: string | null;
  arguments: Record<string, unknown> | null;
  requiresConfirmation: boolean;
  previewKind: AssistantPreviewKind;
  preview: CreateTaskPreview | ReschedulePreview | GenericActionPreview | null;
  results: TaskSummary[] | null;
}

export interface VoiceCommandResult {
  kind: 'create_task' | 'assistant';
  data: TaskDraft | AssistantTurn;
}

/** One rendered bubble in the AI Assistant chat — client-side only, never persisted here. */
export interface ChatBubble {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  turn?: AssistantTurn;
  status?: 'pending' | 'confirmed' | 'cancelled';
  error?: boolean;
}
