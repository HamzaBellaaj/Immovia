import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'connexion' },
  {
    path: 'connexion',
    title: 'Connexion — Immovia',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    path: 'inscription',
    title: 'Inscription — Immovia',
    loadComponent: () => import('./pages/signup/signup').then((m) => m.Signup),
  },
  {
    path: 'verification-email',
    title: 'Vérification e-mail — Immovia',
    loadComponent: () =>
      import('./pages/verification-email/verification-email').then((m) => m.VerificationEmail),
  },
  {
    path: 'auth/callback',
    title: 'Bienvenue — Immovia',
    loadComponent: () => import('./pages/auth-callback/auth-callback').then((m) => m.AuthCallback),
  },
  {
    path: 'mot-de-passe-oublie',
    title: 'Mot de passe oublié — Immovia',
    loadComponent: () =>
      import('./pages/forgot-password/forgot-password').then((m) => m.ForgotPassword),
  },
  {
    path: 'nouveau-mot-de-passe',
    title: 'Nouveau mot de passe — Immovia',
    loadComponent: () =>
      import('./pages/reset-password/reset-password').then((m) => m.ResetPassword),
  },
  {
    path: 'profil',
    title: 'Mon profil — Immovia',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/profile/profile').then((m) => m.ProfilePage),
  },
  {
    path: 'devenir-proprietaire',
    title: 'Devenir propriétaire — Immovia',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/become-owner/become-owner').then((m) => m.BecomeOwner),
  },
  { path: '**', redirectTo: 'connexion' },
];
