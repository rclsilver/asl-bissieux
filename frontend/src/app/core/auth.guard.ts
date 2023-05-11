import { CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';
import { inject } from '@angular/core';

export const isAuthenticated: CanActivateFn = (route, state) => {
  return inject(AuthService).active$;
};

export const isAdministrator: CanActivateFn = (route, state) => {
  return inject(AuthService).administrator$;
};

/*
@Injectable()
export class AuthGuard implements CanActivateFn {
  constructor(private _auth: AuthService) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    return this._auth.loading$.pipe(
      filter(loading => !loading),
      switchMap(_ => this.authService.isAuthenticated$),
      tap(isAuthenticated => isAuthenticated || this._auth.login(state.url)),
    );
  }
}
*/
