import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Subtask } from '../../../core/models/task.model';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'tf-subtask-row',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="subtask-row" [class.is-done]="subtask().isDone">
      <button
        type="button"
        class="task-checkbox"
        style="width:18px;height:18px"
        [class.is-checked]="subtask().isDone"
        (click)="toggle.emit(subtask().id)"
        [attr.aria-label]="'Toggle subtask: ' + subtask().text"
      >
        <tf-icon name="check" [size]="10" [strokeWidth]="3" />
      </button>
      <span class="subtask-text">{{ subtask().text }}</span>
      <button
        type="button"
        class="subtask-remove"
        (click)="remove.emit(subtask().id)"
        [attr.aria-label]="'Remove subtask: ' + subtask().text"
      >
        ×
      </button>
    </div>
  `,
})
export class SubtaskRowComponent {
  readonly subtask = input.required<Subtask>();
  readonly toggle = output<string>();
  readonly remove = output<string>();
}
