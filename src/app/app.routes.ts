import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { mustChangePasswordGuard } from './core/guards/must-change-password.guard';
import { DesktopLayoutComponent } from './layout/desktop/desktop-layout.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'login',
    loadComponent: () => import('./core/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./features/auth/forgot-password.component').then((m) => m.ForgotPasswordComponent),
  },
  {
    path: 'change-password',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auth/force-change-password.component').then((m) => m.ForceChangePasswordComponent),
  },
  {
    path: '',
    component: DesktopLayoutComponent,
    canActivate: [authGuard, mustChangePasswordGuard],
    children: [
      {
        path: 'dashboard',
        loadChildren: () => import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
      },
      {
        path: 'tasks',
        loadChildren: () => import('./features/tasks/tasks.routes').then((m) => m.TASKS_ROUTES),
      },
      {
        path: 'calendar',
        loadChildren: () => import('./features/calendar/calendar.routes').then((m) => m.CALENDAR_ROUTES),
      },
      {
        path: 'categories',
        loadChildren: () => import('./features/categories/categories.routes').then((m) => m.CATEGORIES_ROUTES),
      },
      {
        path: 'tags',
        loadChildren: () => import('./features/tags/tags.routes').then((m) => m.TAGS_ROUTES),
      },
      {
        path: 'reminders',
        loadChildren: () => import('./features/reminders/reminders.routes').then((m) => m.REMINDERS_ROUTES),
      },
      {
        path: 'notifications',
        loadChildren: () => import('./features/notifications/notifications.routes').then((m) => m.NOTIFICATIONS_ROUTES),
      },
      {
        path: 'voice',
        loadChildren: () => import('./features/voice/voice.routes').then((m) => m.VOICE_ROUTES),
      },
      {
        path: 'settings',
        loadChildren: () => import('./features/settings/settings.routes').then((m) => m.SETTINGS_ROUTES),
      },
      {
        path: 'admin',
        canActivate: [adminGuard],
        loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
      },
      {
        path: 'forbidden',
        loadComponent: () =>
          import('./features/errors/forbidden.component').then((m) => m.ForbiddenComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
