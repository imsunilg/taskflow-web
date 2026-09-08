import {
  ApplicationConfig,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
  inject,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withPreloading, PreloadAllModules } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { catchError, firstValueFrom, of } from 'rxjs';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { AuthService } from './core/auth/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding(), withPreloading(PreloadAllModules)),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, errorInterceptor])),
    // Restore the session from the refresh cookie before the first navigation so
    // the auth guard sees the real auth state (no refresh -> /login bounce).
    provideAppInitializer(() => {
      const auth = inject(AuthService);
      return firstValueFrom(auth.restoreSession().pipe(catchError(() => of(false))));
    }),
  ],
};
