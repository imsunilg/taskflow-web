import { Routes } from '@angular/router';

export const REMINDERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./reminders.component').then((m) => m.RemindersComponent),
  },
];
