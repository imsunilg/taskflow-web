import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { AuthService, CaptchaConfig } from '../../core/auth/auth.service';

interface WidgetApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      'error-callback'?: () => void;
      'expired-callback'?: () => void;
    },
  ) => unknown;
}

const SCRIPTS: Record<Exclude<CaptchaConfig['provider'], 'disabled'>, { src: string; global: string }> = {
  turnstile: {
    src: 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
    global: 'turnstile',
  },
  recaptcha: {
    src: 'https://www.google.com/recaptcha/api.js?render=explicit',
    global: 'grecaptcha',
  },
  hcaptcha: {
    src: 'https://js.hcaptcha.com/1/api.js?render=explicit',
    global: 'hcaptcha',
  },
};

/**
 * Renders the configured CAPTCHA provider and emits its verification token. When the
 * backend reports provider "disabled" (local dev with no external keys) it shows a clear
 * development notice and emits the server-provided dev bypass token — which the backend
 * only honours in the Development environment.
 */
@Component({
  selector: 'tf-captcha',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (state()) {
      @case ('loading') {
        <p class="captcha-status" role="status">Loading verification…</p>
      }
      @case ('disabled') {
        <p class="captcha-status captcha-dev" role="status">
          Development mode — CAPTCHA verification is bypassed.
        </p>
      }
      @case ('error') {
        <p class="captcha-status captcha-error" role="alert">
          Verification could not load. Refresh and try again.
        </p>
      }
      @default {
        <div #host class="captcha-host"></div>
      }
    }
  `,
})
export class CaptchaComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly host = viewChild<ElementRef<HTMLDivElement>>('host');

  /** Emits the current token, or null when it expires / errors and must be re-solved. */
  readonly token = output<string | null>();

  readonly state = signal<'loading' | 'ready' | 'disabled' | 'error'>('loading');
  private pollHandle?: number;

  ngOnInit(): void {
    this.auth.getCaptchaConfig().subscribe({
      next: (res) => {
        const cfg = res.data;
        if (!cfg || cfg.provider === 'disabled') {
          this.state.set('disabled');
          this.token.emit(cfg?.devBypassToken || 'dev-captcha-bypass');
          return;
        }
        this.render(cfg);
      },
      error: () => this.state.set('error'),
    });
  }

  ngOnDestroy(): void {
    if (this.pollHandle) window.clearInterval(this.pollHandle);
  }

  private render(cfg: CaptchaConfig): void {
    const meta = SCRIPTS[cfg.provider as Exclude<CaptchaConfig['provider'], 'disabled'>];
    this.loadScript(meta.src)
      .then(() => this.waitForGlobal(meta.global))
      .then((api) => {
        this.state.set('ready');
        // give the @if a tick to place the host element
        queueMicrotask(() => {
          const el = this.host()?.nativeElement;
          if (!el) {
            this.state.set('error');
            return;
          }
          api.render(el, {
            sitekey: cfg.siteKey,
            callback: (t: string) => this.token.emit(t),
            'expired-callback': () => this.token.emit(null),
            'error-callback': () => this.token.emit(null),
          });
        });
      })
      .catch(() => this.state.set('error'));
  }

  private loadScript(src: string): Promise<void> {
    if (document.querySelector(`script[src="${src}"]`)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('captcha script failed'));
      document.head.appendChild(s);
    });
  }

  private waitForGlobal(name: string): Promise<WidgetApi> {
    return new Promise((resolve, reject) => {
      let tries = 0;
      this.pollHandle = window.setInterval(() => {
        const api = (window as unknown as Record<string, WidgetApi | undefined>)[name];
        if (api?.render) {
          window.clearInterval(this.pollHandle);
          resolve(api);
        } else if (++tries > 50) {
          window.clearInterval(this.pollHandle);
          reject(new Error('captcha global not found'));
        }
      }, 100);
    });
  }
}
