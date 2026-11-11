import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DashboardLayout } from '../../components/dashboard-layout';
import { Feedback } from '../../components/feedback';
import { ProfileService } from '../../services/profile.service';
import { errorMessage } from '../../services/errors';

@Component({
  selector: 'app-become-owner',
  imports: [DashboardLayout, Feedback, ReactiveFormsModule, RouterLink],
  templateUrl: './become-owner.html',
})
export class BecomeOwner implements OnInit {
  readonly profiles = inject(ProfileService);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly form = inject(FormBuilder).nonNullable.group({
    accepted: [false, Validators.requiredTrue],
  });
  async ngOnInit(): Promise<void> {
    await this.profiles.ensureLoaded();
  }
  async activate(): Promise<void> {
    this.form.markAllAsTouched();
    if (
      this.form.invalid ||
      this.busy() ||
      !this.profiles.profile() ||
      this.profiles.profile()?.owner
    )
      return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.profiles.becomeOwner();
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
