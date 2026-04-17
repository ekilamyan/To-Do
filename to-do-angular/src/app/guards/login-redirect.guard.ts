import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const loginRedirectGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (auth.authLoading()) {
    return toObservable(auth.authLoading).pipe(
      filter(loading => !loading),
      take(1),
      map(() => auth.isLoggedIn() ? router.createUrlTree(['/active']) : true)
    );
  }

  return auth.isLoggedIn() ? router.createUrlTree(['/active']) : true;
};
