import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { combineLatest, filter, map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { SubscriptionService } from '../services/subscription.service';

export const adminGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const sub    = inject(SubscriptionService);
  const router = inject(Router);

  const check = () => sub.isAdmin() ? true : router.createUrlTree(['/active']);

  if (!auth.authLoading() && !sub.profileLoading()) {
    return check();
  }

  return combineLatest([
    toObservable(auth.authLoading),
    toObservable(sub.profileLoading),
  ]).pipe(
    filter(([authL, profileL]) => !authL && !profileL),
    take(1),
    map(() => check()),
  );
};
