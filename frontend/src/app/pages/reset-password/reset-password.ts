import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthLayout } from '../../components/auth-layout';
import { FormField } from '../../components/form-field';
import { Feedback } from '../../components/feedback';
import { AuthService } from '../../services/auth.service';
import { errorMessage } from '../../services/errors';
import { matchingPasswords, passwordValidators } from '../../services/form-validation';

@Component({
  selector: 'app-reset-password',
  imports: [AuthLayout, FormField, Feedback, ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.html',
})
export class ResetPassword implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly checking = signal(true);
  readonly valid = signal(false);
  readonly busy = signal(false);
  readonly done = signal(false);
  readonly logoutFailed = signal(false);
  readonly error = signal('');
  readonly form = inject(FormBuilder).nonNullable.group(
    {
      password: ['', passwordValidators],
      confirm: ['', Validators.required],
    },
    { validators: matchingPasswords },
  );

  async ngOnInit(): Promise<void> {
    try {
      this.valid.set(await this.auth.validRecovery());
      if (!this.valid())
        this.error.set('Le lien de récupération est absent ou expiré. Demandez un nouveau lien.');
    } catch {
      this.error.set('Impossible de vérifier le lien. Vérifiez votre connexion et réessayez.');
    } finally {
      this.checking.set(false);
    }
  }
  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (!this.valid() || this.form.invalid || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.resetPassword(this.form.getRawValue().password);
      this.form.reset();
      this.done.set(true);
      this.valid.set(false);
      await this.finishLogout();
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
  async finishLogout(): Promise<void> {
    this.busy.set(true);
    try {
      await this.auth.signOut();
      this.logoutFailed.set(false);
      this.error.set('');
    } catch {
      this.logoutFailed.set(true);
      this.error.set(
        'Votre mot de passe est bien modifié, mais la déconnexion n’a pas abouti. Réessayez pour terminer.',
      );
    } finally {
      this.busy.set(false);
    }
  }
  async back(): Promise<void> {
    await this.router.navigateByUrl('/connexion');
  }
}
