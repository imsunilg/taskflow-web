import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Priority } from '../../../core/models/task.model';
import { getPriorityColor, PRIORITIES, PRIORITY_LABEL } from '../../utilities/priority.utils';

@Component({
  selector: 'tf-priority-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="priority-picker" role="radiogroup" aria-label="Priority">
      @for (p of priorities; track p) {
        <button
          type="button"
          role="radio"
          [attr.aria-checked]="value() === p"
          class="priority-opt"
          [class.is-active]="value() === p"
          [attr.data-priority]="p"
          (click)="valueChange.emit(p)"
        >
          <span class="swatch" [style.background]="color(p)"></span>
          {{ label(p) }}
        </button>
      }
    </div>
  `,
})
export class PriorityPickerComponent {
  readonly value = input<Priority>('Medium');
  readonly valueChange = output<Priority>();

  readonly priorities = PRIORITIES;
  label(p: Priority): string {
    return PRIORITY_LABEL[p];
  }
  color(p: Priority): string {
    return getPriorityColor(p);
  }
}
