import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthLayout } from '../../components/auth-layout';
import { FormField } from '../../components/form-field';
import { Feedback } from '../../components/feedback';
import { AuthService } from '../../services/auth.service';
import { errorMessage } from '../../services/errors';
import { emailValidators } from '../../services/form-validation';

@Component({
  selector: 'app-forgot-password',
  imports: [AuthLayout, FormField, Feedback, ReactiveFormsModule, RouterLink],
  template: `<app-auth-layout
    ><div class="eyebrow">Retrouver votre espace</div>
    <h1>Un nouveau<br />départ.</h1>
    <p class="intro">Indiquez votre adresse e-mail pour recevoir un lien de réinitialisation.</p>
    <app-feedback
      [error]="error()"
      [success]="
        sent()
          ? 'Si un compte correspond à cette adresse, vous recevrez un e-mail contenant les instructions. Consultez aussi vos courriers indésirables.'
          : ''
      "
    />
    @if (!sent()) {
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate [attr.aria-busy]="busy()">
        <fieldset [disabled]="busy()">
          <app-form-field
            fieldId="forgot-email"
            label="Adresse e-mail"
            type="email"
            autocomplete="email"
            placeholder="exemple@email.com"
            [control]="form.controls.email"
          />
          <button class="btn btn-primary full" type="submit" [disabled]="busy()">
            {{ busy() ? 'Envoi en cours…' : 'Recevoir le lien' }} <span aria-hidden="true">→</span>
          </button>
        </fieldset>
      </form>
    }
    <div class="form-switch">
      <a class="text-link" routerLink="/connexion">← Revenir à la connexion</a>
    </div></app-auth-layout
  >`,
})
export class ForgotPassword {
  private readonly auth = inject(AuthService);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly sent = signal(false);
  readonly form = inject(FormBuilder).nonNullable.group({ email: ['', emailValidators] });
  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.requestPasswordReset(this.form.getRawValue().email.trim());
      this.sent.set(true);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
