import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const api = new URL(environment.apiUrl);
  const target = new URL(request.url, window.location.origin);
  // Ne jamais transmettre le JWT a Supabase, Google, un asset ou une autre origine.
  if (target.origin !== api.origin || !target.pathname.startsWith('/api/profile/'))
    return next(request);
  return from(inject(AuthService).accessToken()).pipe(
    switchMap((token) =>
      next(token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request),
    ),
  );
};
