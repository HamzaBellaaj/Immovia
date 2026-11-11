import { Component, inject, signal } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { Feedback } from './feedback';

@Component({
  selector: 'app-postman-token-button',
  imports: [Feedback],
  template: `
    @if (auth.authenticated()) {
      <button type="button" class="text-link" [disabled]="copying()" (click)="copyAccessToken()">
        Copier le token pour Postman
      </button>
      <app-feedback [success]="success()" [error]="error()" />
    }
  `,
})
export class PostmanTokenButton {
  readonly auth = inject(AuthService);
  readonly copying = signal(false);
  readonly success = signal('');
  readonly error = signal('');

  async copyAccessToken(): Promise<void> {
    if (this.copying() || !this.auth.authenticated()) return;
    this.copying.set(true);
    this.success.set('');
    this.error.set('');
    const userId = this.auth.user()?.id;
    try {
      // accessToken() utilise client.auth.getSession() et retourne seulement session.access_token.
      const accessToken = await this.auth.accessToken();
      if (!accessToken || !this.auth.authenticated() || this.auth.user()?.id !== userId) {
        this.error.set('Votre session est absente ou expirée. Reconnectez-vous.');
        return;
      }
      await navigator.clipboard.writeText(accessToken);
      this.success.set('Token copié. Dans Postman, utilisez Authorization → Bearer Token.');
    } catch {
      this.error.set('Copie impossible. Autorisez le presse-papiers et réessayez depuis localhost ou HTTPS.');
    } finally {
      this.copying.set(false);
    }
  }
}
