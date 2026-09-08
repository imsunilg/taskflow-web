import { Routes } from '@angular/router';

export const TAGS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./tags.component').then((m) => m.TagsComponent),
  },
];
