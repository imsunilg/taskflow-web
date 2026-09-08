# TaskFlow Web

Angular 22, standalone components, signals, OnPush, lazy-loaded features.

## Run locally

```bash
npm install
npm start          # ng serve on http://localhost:4200, /api + /hubs proxied to :5000
```

Start the API first (`taskflow-api`, port 5000). Log in with `demo@taskflow.app` / `password123`.

## Structure (playbook §2)

```
src/app/
  core/      auth/ guards/ interceptors/ services/ (ApiService, TaskStore, SearchService,
             NotificationService, ThemeService, UiStateService) models/
  shared/    components/ (task-card, priority-picker, subtask-row, tag-chip,
             quick-add, task-detail) pipes/ utilities/
  features/  dashboard tasks calendar reminders categories tags notifications voice settings
  layout/    desktop/ (the responsive shell) mobile/
  app.routes.ts
```

## Build & test

```bash
npm run build          # production build → dist/taskflow-web/browser
npm test               # vitest via @angular/build:unit-test (jsdom)
npm run test:coverage  # + coverage report
```

Specs cover the pipes, `TaskCardComponent`, `PriorityPickerComponent`, `TaskStore`
(optimistic create/rollback), the `VoiceComponent` state machine, and an axe-core
WCAG 2 AA pass on the leaf components (`src/app/tests/a11y.spec.ts`).

Dev ports: web **4095**, API **5095** (proxied via `proxy.conf.json`).
