import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { IdleService } from '../services/idle.service';

@Component({
  selector: 'tf-session-warning',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (idle.warningOpen()) {
      <div class="scrim"></div>
      <div class="modal">
        <div
          class="modal-card confirm-card"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="tf-sw-title"
          aria-describedby="tf-sw-desc"
        >
          <h3 id="tf-sw-title">Your session will expire in 1 minute</h3>
          <p id="tf-sw-desc">
            You've been inactive for a while. For your security you'll be signed out in
            {{ idle.secondsLeft() }} second{{ idle.secondsLeft() === 1 ? '' : 's' }}.
            Anything you've typed will stay on screen.
          </p>
          <div class="confirm-actions">
            <button #signout class="btn btn-ghost" type="button" (click)="idle.signOutFromWarning()">
              Sign out
            </button>
            <button #stay class="btn btn-accent" type="button" (click)="idle.stayActive()">
              Stay signed in
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class SessionWarningComponent {
  readonly idle = inject(IdleService);
  private readonly stayBtn = viewChild<ElementRef<HTMLButtonElement>>('stay');

  constructor() {
    effect(() => {
      if (this.idle.warningOpen()) {
        queueMicrotask(() => this.stayBtn()?.nativeElement.focus());
      }
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.idle.warningOpen()) this.idle.stayActive();
  }
}
