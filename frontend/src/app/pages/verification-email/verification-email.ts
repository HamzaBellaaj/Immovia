import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthLayout } from '../../components/auth-layout';
import { Feedback } from '../../components/feedback';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-verification-email',
  imports: [AuthLayout, Feedback, RouterLink],
  template: `<app-auth-layout
    ><div class="status-icon" aria-hidden="true">✉</div>
    <div class="eyebrow">Encore une petite étape</div>
    <h1>Consultez votre<br />boîte e-mail.</h1>
    <p class="intro">
      Si l’inscription peut être effectuée, un lien de confirmation vous a été envoyé. Confirmez
      votre adresse pour accéder à votre espace Immovia.
    </p>
    <app-feedback [error]="auth.callbackError()" />
    <div class="notice">
      Ouvrez le lien dans le navigateur utilisé pour l’inscription. Pensez à vérifier les courriers
      indésirables. Un lien expiré ou déjà utilisé nécessite une nouvelle inscription ou une
      connexion si votre adresse est déjà confirmée.
    </div>
    <a class="btn btn-primary full" routerLink="/connexion"
      >Revenir à la connexion <span aria-hidden="true">→</span></a
    >
    <div class="form-switch">
      <a class="text-link" routerLink="/inscription">Revenir à l’inscription</a>
    </div>
  </app-auth-layout>`,
})
export class VerificationEmail {
  readonly auth = inject(AuthService);
}
