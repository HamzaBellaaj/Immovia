import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthLayout } from '../../components/auth-layout';
import { FormField } from '../../components/form-field';
import { Feedback } from '../../components/feedback';
import { AuthService } from '../../services/auth.service';
import { errorMessage } from '../../services/errors';
import { emailValidators } from '../../services/form-validation';

@Component({
  selector: 'app-login',
  imports: [AuthLayout, FormField, Feedback, ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
})
export class Login {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', emailValidators],
    password: ['', Validators.required],
  });

  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.signIn(email.trim(), password);
      this.form.controls.password.reset();
      await this.router.navigateByUrl('/profil');
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
  async google(): Promise<void> {
    if (this.busy()) return;
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
