import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'tf-tag-chip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="tag-pill">
      #{{ label() }}
      @if (removable()) {
        <button type="button" (click)="remove.emit()" [attr.aria-label]="'Remove tag ' + label()">×</button>
      }
    </span>
  `,
})
export class TagChipComponent {
  readonly label = input.required<string>();
  readonly removable = input<boolean>(true);
  readonly remove = output<void>();
}
