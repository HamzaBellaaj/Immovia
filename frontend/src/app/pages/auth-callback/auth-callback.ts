import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthLayout } from '../../components/auth-layout';
import { Feedback } from '../../components/feedback';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-auth-callback',
  imports: [AuthLayout, Feedback, RouterLink],
  template: `<app-auth-layout
    ><div class="eyebrow">Votre espace Immovia</div>
    <h1>Bienvenue<br />chez vous.</h1>
    <p class="intro">Nous vérifions votre lien pour vous diriger vers votre espace.</p>
    <app-feedback [error]="error()" [loading]="loading() ? 'Vérification en cours…' : ''" />
    @if (!loading()) {
      <a class="btn btn-primary full" routerLink="/connexion">Revenir à la connexion</a>
      <div class="form-switch">
        <a class="text-link" routerLink="/mot-de-passe-oublie"
          >Demander un nouveau lien de récupération</a
        >
      </div>
    }
  </app-auth-layout>`,
})
export class AuthCallback implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly loading = signal(true);
  readonly error = signal('');
  async ngOnInit(): Promise<void> {
    await this.auth.initialize();
    if (this.auth.callbackError()) this.error.set(this.auth.callbackError());
    else if (this.auth.recovering())
      await this.router.navigateByUrl('/nouveau-mot-de-passe', { replaceUrl: true });
    else if (this.auth.authenticated())
      await this.router.navigateByUrl('/profil', { replaceUrl: true });
    else
      this.error.set(
        'Aucun lien valide n’a été reçu. Reconnectez-vous ou demandez un nouveau lien.',
      );
    this.loading.set(false);
  }
}
