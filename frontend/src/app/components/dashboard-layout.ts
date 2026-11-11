import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Brand } from './brand';
import { Feedback } from './feedback';
import { AuthService } from '../services/auth.service';
import { ProfileService } from '../services/profile.service';
import { errorMessage } from '../services/errors';

@Component({
  selector: 'app-dashboard-layout',
  imports: [Brand, Feedback, RouterLink, RouterLinkActive],
  templateUrl: './dashboard-layout.html',
})
export class DashboardLayout {
  readonly title = input('Mon profil');
  readonly auth = inject(AuthService);
  readonly profiles = inject(ProfileService);
  private readonly router = inject(Router);
  readonly error = signal('');
  readonly leaving = signal(false);
  readonly initials = computed(() => {
    const profile = this.profiles.profile();
    return profile ? `${profile.prenom.charAt(0)}${profile.nom.charAt(0)}`.toUpperCase() : 'I';
  });
  constructor() {
    effect(() => {
      if (!this.auth.authenticated()) void this.router.navigateByUrl('/connexion');
      else if (this.auth.recovering()) void this.router.navigateByUrl('/nouveau-mot-de-passe');
    });
  }
  async signOut(): Promise<void> {
    this.leaving.set(true);
    this.error.set('');
    try {
      await this.auth.signOut();
      await this.router.navigateByUrl('/connexion');
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.leaving.set(false);
    }
  }
}
