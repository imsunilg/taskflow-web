import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DesktopLayoutComponent } from '../desktop/desktop-layout.component';

/**
 * The shell does not fork the component tree: DesktopLayoutComponent adapts to
 * mobile via CSS media queries (bottom nav, hamburger drawer, bottom sheets).
 * This component exists to satisfy the folder contract in playbook.md §2 and can
 * be used directly if a hard mobile-only route is ever required.
 */
@Component({
  selector: 'tf-mobile-layout',
  standalone: true,
  imports: [DesktopLayoutComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<tf-desktop-layout />`,
})
export class MobileLayoutComponent {}
