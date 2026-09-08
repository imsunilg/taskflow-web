import { Routes } from '@angular/router';

export const VOICE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./voice.component').then((m) => m.VoiceComponent),
  },
];
