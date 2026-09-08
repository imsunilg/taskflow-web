import { Injectable, effect, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>(this.readStored());

  constructor() {
    effect(() => {
      const mode = this.mode();
      try {
        localStorage.setItem('tf-theme', mode);
      } catch {
        /* ignore */
      }
      const resolved =
        mode === 'system'
          ? window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light'
          : mode;
      document.documentElement.setAttribute('data-theme', resolved);
    });
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
  }

  private readStored(): ThemeMode {
    try {
      return (localStorage.getItem('tf-theme') as ThemeMode) || 'system';
    } catch {
      return 'system';
    }
  }
}
