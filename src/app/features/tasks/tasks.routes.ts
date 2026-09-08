import { Routes } from '@angular/router';

const load = () => import('./tasks.component').then((m) => m.TasksComponent);

export const TASKS_ROUTES: Routes = [
  { path: 'today', loadComponent: load, data: { view: 'today' } },
  { path: 'upcoming', loadComponent: load, data: { view: 'upcoming' } },
  { path: 'all', loadComponent: load, data: { view: 'all' } },
  { path: 'important', loadComponent: load, data: { view: 'important' } },
  { path: 'overdue', loadComponent: load, data: { view: 'overdue' } },
  { path: 'inbox', loadComponent: load, data: { view: 'inbox' } },
  { path: 'completed', loadComponent: load, data: { view: 'completed' } },
  { path: '', redirectTo: 'all', pathMatch: 'full' },
];
