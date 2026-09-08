export type NotificationType = 'Reminder' | 'Overdue' | 'Recurring';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  readAt: string | null;
  createdAt: string;
}
