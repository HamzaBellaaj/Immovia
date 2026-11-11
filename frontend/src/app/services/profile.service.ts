import { HttpClient } from '@angular/common/http';
import { Injectable, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { Profile, ProfileDto, ProfileUpdate } from '../models/profile';
import { AuthService } from './auth.service';
import { errorMessage } from './errors';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly base = `${environment.apiUrl.replace(/\/$/, '')}/api/profile`;
  readonly profile = signal<Profile | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  private loadedUser: string | null = null;
  private pending?: { userId: string; promise: Promise<void> };

  constructor() {
    effect(() => {
      const userId = this.auth.user()?.id;
      if (!userId || userId !== this.loadedUser) this.profile.set(null);
      if (!userId) {
        this.loadedUser = null;
        this.error.set('');
      }
    });
  }

  /** Un seul POST sync puis GET par session utilisateur ; jamais de profil invente. */
  ensureLoaded(force = false): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId || !this.auth.authenticated()) return Promise.resolve();
    if (this.pending?.userId === userId) return this.pending.promise;
    if (!force && this.loadedUser === userId && this.profile()) return Promise.resolve();
    const promise = this.synchronize(userId);
    this.pending = { userId, promise };
    return promise;
  }

  private async synchronize(userId: string): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.http.post<void>(`${this.base}/sync`, {}));
      const profile = this.validate(
        await firstValueFrom(this.http.get<unknown>(`${this.base}/me`)),
      );
      if (this.auth.user()?.id === userId) {
        this.profile.set(profile);
        this.loadedUser = userId;
      }
    } catch (error) {
      if (this.auth.user()?.id === userId) this.error.set(errorMessage(error));
    } finally {
      if (this.pending?.userId === userId) this.pending = undefined;
      this.loading.set(false);
    }
  }

  async update(update: ProfileUpdate): Promise<void> {
    const userId = this.auth.user()?.id;
    await firstValueFrom(
      this.http.put<unknown>(`${this.base}/me`, {
        firstName: update.prenom,
        lastName: update.nom,
        phone: update.telephone,
      }),
    );
    const profile = this.validate(await firstValueFrom(this.http.get<unknown>(`${this.base}/me`)));
    if (this.auth.user()?.id === userId) this.profile.set(profile);
  }

  async becomeOwner(): Promise<void> {
    const userId = this.auth.user()?.id;
    await firstValueFrom(this.http.post<unknown>(`${this.base}/become-owner`, {}));
    const profile = this.validate(await firstValueFrom(this.http.get<unknown>(`${this.base}/me`)));
    if (this.auth.user()?.id === userId) this.profile.set(profile);
    if (!profile.owner) throw { code: 'owner_not_confirmed' };
  }

  health(): Promise<unknown> {
    return firstValueFrom(this.http.get(`${environment.apiUrl.replace(/\/$/, '')}/api/health`));
  }

  private validate(value: unknown): Profile {
    if (!value || typeof value !== 'object') throw { code: 'invalid_profile_response' };
    const profile = value as Partial<ProfileDto>;
    const nullableText = (field: unknown) => field === null || typeof field === 'string';
    if (
      typeof profile.id !== 'string' ||
      !nullableText(profile.firstName) ||
      !nullableText(profile.lastName) ||
      !nullableText(profile.email) ||
      !nullableText(profile.phone) ||
      typeof profile.isOwner !== 'boolean' ||
      typeof profile.createdAt !== 'string' ||
      typeof profile.updatedAt !== 'string'
    ) {
      throw { code: 'invalid_profile_response' };
    }
    return {
      id: profile.id,
      prenom: profile.firstName ?? '',
      nom: profile.lastName ?? '',
      email: profile.email ?? '',
      telephone: profile.phone ?? null,
      owner: profile.isOwner,
    };
  }
}
