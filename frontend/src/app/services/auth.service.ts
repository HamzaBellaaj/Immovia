import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { errorMessage } from './errors';

interface RecoveryContext {
  userId: string;
  expiresAt: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);
  private readonly recoveryKey = 'immovia.recovery';
  private readonly sessionState = signal<Session | null>(null);
  readonly session = this.sessionState.asReadonly();
  readonly user = computed(() => this.session()?.user ?? null);
  readonly authenticated = computed(() => !!this.user()?.email_confirmed_at);
  readonly recovering = signal(false);
  readonly callbackError = signal('');
  readonly callbackReceived = signal(false);
  private initialization?: Promise<void>;
  private initialized = false;

  // Le SDK gere les JWT, leur stockage et leur renouvellement. Pas de JWT maison.
  private client!: SupabaseClient;

  private observeSession(): void {
    this.client.auth.onAuthStateChange((event, session) => {
      this.sessionState.set(session);
      if (event === 'SIGNED_OUT' || !session) this.clearRecovery();
      if (event === 'PASSWORD_RECOVERY' && session) {
        this.markRecovery(session);
        // Ne pas attendre un appel Supabase dans le callback (verrou interne du SDK).
        if (this.initialized)
          setTimeout(() => void this.router.navigateByUrl('/nouveau-mot-de-passe'), 0);
      }
    });
  }

  initialize(): Promise<void> {
    return (this.initialization ??= this.createAndRestoreSession());
  }

  private async createAndRestoreSession(): Promise<void> {
    const { createClient } = await import('@supabase/supabase-js');
    this.client = createClient(environment.supabaseUrl, environment.supabasePublishableKey, {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: false,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    this.observeSession();
    await this.restoreSession();
  }

  private async restoreSession(): Promise<void> {
    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.hash.slice(1));
    url.searchParams.forEach((value, key) => params.set(key, value));
    const isCallback = [
      'code',
      'access_token',
      'refresh_token',
      'token_hash',
      'error',
      'error_code',
      'error_description',
    ].some((key) => params.has(key));
    this.callbackReceived.set(isCallback);
    // Nettoyer immediatement l'URL avant toute navigation Angular ou requete HTTP.
    if (isCallback) window.history.replaceState({}, '', '/auth/callback');
    try {
      const { error: initializationError } = await this.client.auth.initialize();
      if (initializationError) throw initializationError;
      if (params.has('error') || params.has('error_code') || params.has('error_description')) {
        throw { code: params.get('error_code') || params.get('error') || 'invalid_grant' };
      }
      let callbackSession: Session | null = null;
      let recovery = false;
      if (params.has('code')) {
        const flowId = params.get('sb_flow_id');
        const { data, error } = await this.client.auth.exchangeCodeForSession(
          params.get('code')!,
          flowId ? { flowId } : undefined,
        );
        if (error) throw error;
        callbackSession = data.session;
        // Le SDK emet PASSWORD_RECOVERY pendant l'echange du code PKCE.
        recovery = this.recovering();
      } else if (params.has('access_token') && params.has('refresh_token')) {
        // Compatibilite avec les liens implicites emis par Supabase ConfirmationURL.
        const { data, error } = await this.client.auth.setSession({
          access_token: params.get('access_token')!,
          refresh_token: params.get('refresh_token')!,
        });
        if (error) throw error;
        callbackSession = data.session;
        recovery = params.get('type') === 'recovery';
      } else if (params.has('token_hash')) {
        const type = params.get('type');
        if (type !== 'email' && type !== 'signup' && type !== 'recovery')
          throw { code: 'invalid_grant' };
        const { data, error } = await this.client.auth.verifyOtp({
          token_hash: params.get('token_hash')!,
          type,
        });
        if (error) throw error;
        callbackSession = data.session;
        recovery = type === 'recovery';
      } else if (isCallback) {
        throw { code: 'invalid_grant' };
      }
      const { data, error } = await this.client.auth.getSession();
      if (error) throw error;
      this.sessionState.set(data.session);
      if (isCallback && !callbackSession) throw { code: 'invalid_grant' };
      if (recovery && callbackSession) this.markRecovery(callbackSession);
      if (data.session && !this.recovering()) {
        const stored = this.readRecovery();
        this.recovering.set(
          stored?.userId === data.session.user.id && stored.expiresAt > Date.now(),
        );
      }
    } catch (error) {
      this.callbackError.set(errorMessage(error));
      if (isCallback) this.clearRecovery();
    } finally {
      this.initialized = true;
    }
  }

  private markRecovery(session: Session): void {
    const context: RecoveryContext = {
      userId: session.user.id,
      expiresAt: Math.min(Date.now() + 30 * 60_000, (session.expires_at ?? 0) * 1000),
    };
    this.recovering.set(true);
    sessionStorage.setItem(this.recoveryKey, JSON.stringify(context));
  }

  private readRecovery(): RecoveryContext | null {
    try {
      return JSON.parse(sessionStorage.getItem(this.recoveryKey) || 'null');
    } catch {
      return null;
    }
  }

  private clearRecovery(): void {
    this.recovering.set(false);
    sessionStorage.removeItem(this.recoveryKey);
  }

  async validRecovery(): Promise<boolean> {
    await this.initialize();
    const context = this.readRecovery();
    if (
      !this.recovering() ||
      !context ||
      context.expiresAt <= Date.now() ||
      context.userId !== this.user()?.id
    ) {
      this.clearRecovery();
      return false;
    }
    const { data, error } = await this.client.auth.getUser();
    if (error || data.user?.id !== context.userId) {
      this.clearRecovery();
      return false;
    }
    return true;
  }

  async signIn(email: string, password: string): Promise<void> {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.user.email_confirmed_at || !data.session) {
      await this.client.auth.signOut({ scope: 'local' });
      throw { code: 'email_not_confirmed' };
    }
    this.clearRecovery();
    this.callbackError.set('');
    this.sessionState.set(data.session);
  }

  async signUp(
    email: string,
    password: string,
    metadata: { prenom: string; nom: string; telephone: string },
  ): Promise<void> {
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: { data: metadata, emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw error;
    // Un objet user ne prouve jamais la confirmation ; rester sur le parcours de verification.
    this.callbackError.set('');
    if (data.session) {
      const { error: signOutError } = await this.client.auth.signOut({ scope: 'local' });
      if (signOutError) throw signOutError;
    }
  }

  async signInWithGoogle(): Promise<void> {
    const { error } = await this.client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'openid email profile',
      },
    });
    if (error) throw error;
  }

  async requestPasswordReset(email: string): Promise<void> {
    const { error } = await this.client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    if (error) throw error;
  }

  async resetPassword(password: string): Promise<void> {
    if (!(await this.validRecovery())) throw { code: 'otp_expired' };
    const { error } = await this.client.auth.updateUser({ password });
    if (error) throw error;
    this.clearRecovery();
  }

  async accessToken(): Promise<string | null> {
    const { data, error } = await this.client.auth.getSession();
    if (error) throw error;
    return data.session?.user.email_confirmed_at ? data.session.access_token : null;
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) throw error;
    this.sessionState.set(null);
    this.clearRecovery();
  }
}
