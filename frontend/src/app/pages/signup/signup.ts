import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthLayout } from '../../components/auth-layout';
import { FormField } from '../../components/form-field';
import { Feedback } from '../../components/feedback';
import { AuthService } from '../../services/auth.service';
import { errorMessage } from '../../services/errors';
import {
  emailValidators,
  matchingPasswords,
  nameValidators,
  passwordValidators,
  phoneValidators,
} from '../../services/form-validation';

@Component({
  selector: 'app-signup',
  imports: [AuthLayout, FormField, Feedback, ReactiveFormsModule, RouterLink],
  templateUrl: './signup.html',
})
export class Signup {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly form = inject(FormBuilder).nonNullable.group(
    {
      prenom: ['', nameValidators],
      nom: ['', nameValidators],
      email: ['', emailValidators],
      telephone: ['', phoneValidators],
      password: ['', passwordValidators],
      confirm: ['', Validators.required],
      conditions: [false, Validators.requiredTrue],
    },
    { validators: matchingPasswords },
  );

  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const value = this.form.getRawValue();
      await this.auth.signUp(value.email.trim(), value.password, {
        prenom: value.prenom.trim(),
        nom: value.nom.trim(),
        telephone: value.telephone.trim(),
      });
      this.form.reset();
      await this.router.navigateByUrl('/verification-email');
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
  async google(): Promise<void> {
    this.form.controls.conditions.markAsTouched();
    if (!this.form.controls.conditions.value || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.signInWithGoogle();
    } catch (error) {
      this.error.set(errorMessage(error));
      this.busy.set(false);
    }
  }
}
