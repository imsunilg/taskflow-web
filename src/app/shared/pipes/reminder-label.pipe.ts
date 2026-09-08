import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'reminderLabel', standalone: true })
export class ReminderLabelPipe implements PipeTransform {
  transform(offsetMinutes: number | null | undefined): string {
    if (offsetMinutes === null || offsetMinutes === undefined) return '';
    if (offsetMinutes === 0) return 'At due time';
    if (offsetMinutes % 1440 === 0) {
      const days = offsetMinutes / 1440;
      return `${days} day${days > 1 ? 's' : ''} before`;
    }
    if (offsetMinutes % 60 === 0) {
      const hours = offsetMinutes / 60;
      return `${hours} hour${hours > 1 ? 's' : ''} before`;
    }
    return `${offsetMinutes} minutes before`;
  }
}
