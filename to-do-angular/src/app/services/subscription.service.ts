import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../core/supabase.client';
import { AuthService } from './auth.service';
import { ThemeService } from './theme.service';

interface Profile {
  id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: 'free' | 'active' | 'canceled';
  subscription_end_date: string | null;
  is_admin: boolean;
}

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private supabase = inject<SupabaseClient>(SUPABASE_CLIENT);
  private authService = inject(AuthService);
  private themeService = inject(ThemeService);

  private profile = signal<Profile | null>(null);

  readonly isPro = computed(() => this.profile()?.subscription_status === 'active');
  readonly isAdmin = computed(() => this.profile()?.is_admin === true);
  readonly subscriptionStatus = computed(() => this.profile()?.subscription_status ?? 'free');
  readonly subscriptionEndDate = computed(() => this.profile()?.subscription_end_date ?? null);
  readonly dialogOpen = signal(false);
  readonly profileLoading = signal(true);

  constructor() {
    effect(() => {
      if (this.authService.isLoggedIn()) {
        this.loadProfile();
      } else {
        this.profile.set(null);
        this.profileLoading.set(true);
      }
    });
  }

  async loadProfile(): Promise<void> {
    this.profileLoading.set(true);
    const { data } = await this.supabase
      .from('profiles')
      .select('*')
      .single();

    this.profile.set(data as Profile | null);
    this.profileLoading.set(false);

    if (!this.isPro()) {
      this.themeService.setTheme('light');
    }
  }

  openPricingDialog(): void { this.dialogOpen.set(true); }
  closePricingDialog(): void { this.dialogOpen.set(false); }

  async startCheckout(): Promise<void> {
    if (this.isPro()) {
      await this.openBillingPortal();
      return;
    }
    const { data, error } = await this.supabase.functions.invoke('create-checkout-session', {
      body: { origin: window.location.origin },
    });
    if (error) throw error;
    window.location.href = data.url;
  }

  async openBillingPortal(): Promise<void> {
    const { data, error } = await this.supabase.functions.invoke('create-portal-session', {
      body: { origin: window.location.origin },
    });
    if (error) throw error;
    window.location.href = data.url;
  }
}
