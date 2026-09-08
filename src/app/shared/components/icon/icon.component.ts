import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * Small inline-SVG icon set (Feather-style, currentColor stroke). Keeps every
 * screen on one visual language without an external icon dependency.
 */
type IconName =
  | 'menu'
  | 'search'
  | 'plus'
  | 'mic'
  | 'mic-off'
  | 'bell'
  | 'check'
  | 'x'
  | 'star'
  | 'trash'
  | 'clock'
  | 'calendar'
  | 'repeat'
  | 'inbox'
  | 'sun'
  | 'layers'
  | 'alert'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'tag'
  | 'grid'
  | 'settings'
  | 'logo'
  | 'filter'
  | 'play'
  | 'pause'
  | 'stop'
  | 'flag'
  | 'eye'
  | 'eye-off'
  | 'sliders';

const PATHS: Record<IconName, string> = {
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  mic: '<path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z"/><path d="M19 11v1a7 7 0 0 1-14 0v-1M12 19v3"/>',
  'mic-off':
    '<path d="M1 1l22 22M12 15a3 3 0 0 0 3-3v-2M9 6a3 3 0 0 1 6 0v1M19 11v1a7 7 0 0 1-11.4 5.5M5 12.5V11"/>',
  bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  check: '<path d="M4 12l5 5L20 6"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  star: '<path d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 18l-5.8 3 1.1-6.5L2.6 9.8l6.5-.9L12 3Z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M3.5 10h17M8 3v3.5M16 3v3.5"/>',
  repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.5L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.5A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.5Z"/>',
  sun: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v4l2.5 2.5"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5 9-5Z"/><path d="M3 13l9 5 9-5M3 17l9 5 9-5"/>',
  alert: '<path d="M12 3L2 20h20L12 3Z"/><path d="M12 9v5M12 17v.5"/>',
  'chevron-left': '<path d="M15 6l-6 6 6 6"/>',
  'chevron-right': '<path d="M9 6l6 6-6 6"/>',
  'chevron-down': '<path d="M6 9l6 6 6-6"/>',
  tag: '<path d="M20.5 12.5L12 21l-8-8V4h9l7.5 7.5a1 1 0 0 1 0 1Z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.2A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.5 15H3a2 2 0 0 1 0-4h.2A1.6 1.6 0 0 0 4.6 8a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9 3.5h.1A1.6 1.6 0 0 0 10 2a2 2 0 0 1 4 0v.2A1.6 1.6 0 0 0 17 3.5a1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 20.5 9v.1A1.6 1.6 0 0 0 22 10a2 2 0 0 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1Z"/>',
  logo: '<path d="M4 12l6 6L20 6"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  play: '<path d="M7 5l12 7-12 7V5Z"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
  flag: '<path d="M5 21V4M5 4h13l-2.5 5L18 14H5"/>',
  eye: '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off':
    '<path d="M1 1l22 22"/><path d="M10.6 5.1A11 11 0 0 1 12 5c7 0 11 7 11 7a13 13 0 0 1-3 3.5M6.6 6.6A13 13 0 0 0 1 12s4 7 11 7a11 11 0 0 0 4.5-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  sliders: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="7" cy="18" r="2"/>',
};

@Component({
  selector: 'tf-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="strokeWidth()"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      [innerHTML]="markup"
    ></svg>
  `,
  styles: [':host{display:inline-flex}'],
})
export class IconComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly name = input.required<IconName>();
  readonly size = input<number>(18);
  readonly strokeWidth = input<number>(1.8);

  get markup(): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(PATHS[this.name()] ?? '');
  }
}
