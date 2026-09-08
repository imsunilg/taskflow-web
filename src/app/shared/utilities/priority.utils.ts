import { Priority } from '../../core/models/task.model';

export const PRIORITY_ORDER: Record<Priority, number> = {
  Urgent: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  Low: 'Low',
  Medium: 'Medium',
  High: 'High',
  Urgent: 'Urgent',
};

const PRIORITY_COLOR: Record<Priority, string> = {
  Low: '#6b7280',
  Medium: '#3b82f6',
  High: '#f59e0b',
  Urgent: '#ef4444',
};

export function getPriorityColor(priority: Priority): string {
  return PRIORITY_COLOR[priority];
}

export const PRIORITIES: Priority[] = ['Low', 'Medium', 'High', 'Urgent'];
