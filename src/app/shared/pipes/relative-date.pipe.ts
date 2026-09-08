import { Pipe, PipeTransform } from '@angular/core';
import { addDays, isSameDay, parseISO, shortDate } from '../utilities/date.utils';

@Pipe({ name: 'relativeDate', standalone: true })
export class RelativeDatePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '';
    const date = parseISO(value);
    if (Number.isNaN(date.getTime())) return '';

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (isSameDay(date, today)) return 'Today';
    if (isSameDay(date, addDays(today, 1))) return 'Tomorrow';
    if (isSameDay(date, addDays(today, -1))) return 'Yesterday';

    const diffDays = Math.round((date.getTime() - today.getTime()) / 86_400_000);
    if (diffDays > 0 && diffDays < 7) {
      return shortDate(date).split(' ')[0];
    }
    return shortDate(date);
  }
}
