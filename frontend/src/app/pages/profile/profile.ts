import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DashboardLayout } from '../../components/dashboard-layout';
import { Feedback } from '../../components/feedback';
import { FormField } from '../../components/form-field';
import { PostmanTokenButton } from '../../components/postman-token-button';
import { ProfileService } from '../../services/profile.service';
import { errorMessage } from '../../services/errors';
import { nameValidators, phoneValidators } from '../../services/form-validation';

@Component({
  selector: 'app-profile',
  imports: [DashboardLayout, Feedback, FormField, PostmanTokenButton, ReactiveFormsModule, RouterLink],
  templateUrl: './profile.html',
})
export class ProfilePage implements OnInit {
  readonly profiles = inject(ProfileService);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly form = inject(FormBuilder).nonNullable.group({
    prenom: ['', nameValidators],
    nom: ['', nameValidators],
    telephone: ['', phoneValidators],
  });
  constructor() {
    effect(() => {
      const profile = this.profiles.profile();
      if (profile)
        this.form.reset({
          prenom: profile.prenom,
          nom: profile.nom,
          telephone: profile.telephone ?? '',
        });
    });
  }
  async ngOnInit(): Promise<void> {
    await this.profiles.ensureLoaded();
  }
  cancel(): void {
    const profile = this.profiles.profile();
    if (profile)
      this.form.reset({
        prenom: profile.prenom,
        nom: profile.nom,
        telephone: profile.telephone ?? '',
      });
    this.error.set('');
    this.success.set('');
  }
  async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving() || !this.profiles.profile()) return;
    this.saving.set(true);
    this.error.set('');
    this.success.set('');
    try {
      const value = this.form.getRawValue();
      await this.profiles.update({
        prenom: value.prenom.trim(),
        nom: value.nom.trim(),
        telephone: value.telephone.trim(),
      });
      this.success.set('Vos informations ont été enregistrées.');
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
}
