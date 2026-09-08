import { RelativeDatePipe } from './relative-date.pipe';
import { ReminderLabelPipe } from './reminder-label.pipe';
import { toISO, addDays } from '../utilities/date.utils';

describe('RelativeDatePipe', () => {
  const pipe = new RelativeDatePipe();

  it('returns "Today" for today\'s ISO date', () => {
    expect(pipe.transform(toISO(new Date()))).toBe('Today');
  });

  it('returns "Tomorrow" for tomorrow', () => {
    expect(pipe.transform(toISO(addDays(new Date(), 1)))).toBe('Tomorrow');
  });

  it('returns empty string for null', () => {
    expect(pipe.transform(null)).toBe('');
  });

  it('shows a full date for a date 8 days out', () => {
    const out = pipe.transform(toISO(addDays(new Date(), 8)));
    expect(out).toMatch(/\d{1,2}/);
    expect(out).not.toBe('Today');
  });
});

describe('ReminderLabelPipe', () => {
  const pipe = new ReminderLabelPipe();

  it('maps 0 to "At due time"', () => expect(pipe.transform(0)).toBe('At due time'));
  it('maps 60 to "1 hour before"', () => expect(pipe.transform(60)).toBe('1 hour before'));
  it('maps 1440 to "1 day before"', () => expect(pipe.transform(1440)).toBe('1 day before'));
  it('maps 30 to "30 minutes before"', () => expect(pipe.transform(30)).toBe('30 minutes before'));
  it('returns empty string for null', () => expect(pipe.transform(null)).toBe(''));
});
