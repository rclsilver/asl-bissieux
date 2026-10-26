import { CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { inject } from '@angular/core';
import { Observable, combineLatest, filter, map, take } from 'rxjs';

function waitForAuthentication(
  auth: AuthService,
  allowed$: Observable<boolean>,
  path: string
) {
  return combineLatest([auth.loading$, allowed$]).pipe(
    filter(([loading]) => !loading),
    take(1),
    map(([, allowed]) => {
      if (!allowed) auth.rememberReturnPath(path);
      return allowed;
    })
  );
}

export const isAuthenticated: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  return waitForAuthentication(auth, auth.active$, state.url);
};

export const isAdministrator: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  return waitForAuthentication(auth, auth.administrator$, state.url);
};
