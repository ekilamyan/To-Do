import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseClient, Session, User, AuthError } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../core/supabase.client';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private supabase = inject<SupabaseClient>(SUPABASE_CLIENT);

  readonly session     = signal<Session | null>(null);
  readonly user        = signal<User | null>(null);
  readonly userEmail   = computed(() => this.user()?.email ?? null);
  readonly isLoggedIn  = computed(() => this.session() !== null);
  readonly authLoading = signal<boolean>(true);

  constructor() {
    // Resolve current session on startup
    this.supabase.auth.getSession().then(({ data }) => {
      this.session.set(data.session);
      this.user.set(data.session?.user ?? null);
      this.authLoading.set(false);
    });

    // Keep signals in sync for all future auth events
    this.supabase.auth.onAuthStateChange((_event, session) => {
      this.session.set(session);
      this.user.set(session?.user ?? null);
    });
  }

  async signIn(email: string, password: string): Promise<AuthError | null> {
    const { error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) return error;

    const { data: profile } = await this.supabase
      .from('profiles')
      .select('is_active')
      .single();

    if (profile?.is_active === false) {
      await this.supabase.auth.signOut();
      return { name: 'AuthError', message: 'Your account has been deactivated. Please contact support.' } as AuthError;
    }

    return null;
  }

  async signUp(email: string, password: string): Promise<{ error: AuthError | null; needsConfirmation: boolean }> {
    const { data, error } = await this.supabase.auth.signUp({ email, password });
    return {
      error,
      needsConfirmation: !error && !data.session
    };
  }

  async resetPassword(email: string): Promise<AuthError | null> {
    const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`
    });
    return error;
  }

  async signOut(): Promise<void> {
    await this.supabase.auth.signOut();
  }
}
