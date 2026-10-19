import { Injectable, InjectionToken, Injector, inject } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  Subject,
  catchError,
  from,
  map,
  of,
  tap,
  throwError,
} from 'rxjs';
import { ApiService, APIError } from './api.service';
import { APISchemas } from '../api/openapi';
import { WithGoogleAuthService } from 'ngx-sign-in-with-google';

export const AUTH_NAVIGATE = new InjectionToken<(url: string) => void>(
  'Auth navigation',
  {
    providedIn: 'root',
    factory: () => (url) => window.location.assign(url),
  }
);

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _injector = inject(Injector);
  private readonly _api = inject(ApiService);
  private readonly _navigate = inject(AUTH_NAVIGATE);
  private _google?: WithGoogleAuthService;
  private _initialized = false;
  private _returnPath?: string;

  private readonly _configuration$ = new BehaviorSubject<
    APISchemas['AuthPublicAuthConfig'] | null
  >(null);
  readonly configuration$ = this._configuration$.asObservable();
  private readonly _loading$ = new BehaviorSubject(true);
  readonly loading$ = this._loading$.asObservable();
  private readonly _message$ = new BehaviorSubject<string | null>(null);
  readonly message$ = this._message$.asObservable();
  private readonly _user$ = new BehaviorSubject<APISchemas['AuthUser'] | null>(
    null
  );
  readonly user$ = this._user$.asObservable();

  private readonly _token$ = new BehaviorSubject<string | undefined>(undefined);
  readonly token$ = this._token$.asObservable();

  private readonly _unauthenticated$ = new Subject<void>();
  readonly unauthenticated$ = this._unauthenticated$.asObservable();

  readonly authenticated$ = this.user$.pipe(map((user) => !!user));
  readonly active$ = this.user$.pipe(map((user) => user?.enabled ?? false));
  readonly administrator$ = this.user$.pipe(
    map((user) => !!user?.enabled && !!user.admin)
  );

  init() {
    if (this._initialized) return;
    this._initialized = true;
    const url = new URL(window.location.href);
    if (url.searchParams.has('auth_error')) {
      this._message$.next(
        'La connexion n’a pas abouti. Réessaie ou contacte un administrateur si ton compte doit être associé.'
      );
      url.searchParams.delete('auth_error');
      window.history.replaceState(
        null,
        '',
        url.pathname + url.search + url.hash
      );
    }
    this._api.getAuthConfig().subscribe({
      next: (configuration) => {
        if (
          !configuration ||
          !['oidc', 'google'].includes(configuration.mode ?? '')
        ) {
          this.configurationUnavailable();
          return;
        }
        this._configuration$.next(configuration);
        if (configuration.mode === 'oidc') {
          this.loadSession().subscribe();
        } else {
          this._google = this._injector.get(WithGoogleAuthService);
          this._google
            .getEventSubject()
            .subscribe(() => this.googleTokenChanged());
          this.googleTokenChanged();
        }
      },
      error: () => this.configurationUnavailable(),
    });
  }

  private configurationUnavailable() {
    this._loading$.next(false);
    this._message$.next(
      'La connexion est indisponible. Recharge la page pour réessayer.'
    );
  }

  private googleTokenChanged() {
    const token = this._google?.getAccessToken();
    this._token$.next(token);
    if (token) this.loadSession().subscribe();
    else {
      this.clearUser();
      this._loading$.next(false);
    }
  }

  private loadSession(): Observable<APISchemas['AuthUser'] | null> {
    return this._api.getCurrentUser().pipe(
      tap((user) => {
        this._user$.next(user);
        this._loading$.next(false);
      }),
      catchError((error: APIError) => {
        this.clearUser();
        this._loading$.next(false);
        if (error.status !== 401)
          this._message$.next(
            'Impossible de vérifier la connexion. Recharge la page pour réessayer.'
          );
        return of(null);
      })
    );
  }

  login() {
    const path = this._configuration$.value?.login_url;
    if (!path) return;
    const login = new URL(path, window.location.origin);
    if (login.origin !== window.location.origin) return;
    login.searchParams.set(
      'return_to',
      this._returnPath ??
        window.location.pathname + window.location.search + window.location.hash
    );
    this._navigate(login.toString());
  }

  rememberReturnPath(path: string) {
    this._returnPath = path;
  }

  sessionExpired() {
    if (this._configuration$.value?.mode !== 'oidc') return;
    if (this._user$.value)
      this._message$.next(
        'Ta session a expiré. Reconnecte-toi pour continuer.'
      );
    this.clearUser();
  }

  refresh(): Observable<unknown> {
    return this._configuration$.value?.mode === 'oidc'
      ? this.loadSession()
      : from((async () => this._google?.requestNewAccessToken())());
  }

  logout(): Observable<unknown> {
    if (this._configuration$.value?.mode === 'oidc') {
      return this._api.logoutSession().pipe(
        tap((result) => {
          this.clearUser();
          if (result?.redirect_url) this._navigate(result.redirect_url);
        }),
        catchError((error) => {
          this._message$.next(
            'La déconnexion n’a pas abouti. Réessaie avant de fermer cette session.'
          );
          return throwError(() => error);
        })
      );
    }
    return from((async () => this._google?.logout())()).pipe(
      tap(() => this.clearUser())
    );
  }

  private clearUser() {
    this._user$.next(null);
    this._token$.next(undefined);
    this._unauthenticated$.next();
  }

  allowed$(action: string) {
    return this.user$.pipe(
      map(
        (user) =>
          !!user?.enabled && (!!user.admin || !!user.actions?.includes(action))
      )
    );
  }
}
