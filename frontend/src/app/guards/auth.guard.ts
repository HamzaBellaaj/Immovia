import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.initialize();
  if (auth.recovering()) return router.parseUrl('/nouveau-mot-de-passe');
  return auth.authenticated() || router.parseUrl('/connexion');
};
