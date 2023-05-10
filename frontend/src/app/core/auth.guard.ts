import { CanActivateFn } from '@angular/router';

export const isAuthenticated: CanActivateFn = (route, state) => {
  return true;
};

export const isAdministrator: CanActivateFn = (route, state) => {
  return true;
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
