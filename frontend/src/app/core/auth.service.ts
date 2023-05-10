import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { OAuthErrorEvent, OAuthService } from 'angular-oauth2-oidc';
import {
  BehaviorSubject,
  combineLatest,
  Observable,
  of,
  distinctUntilChanged,
  filter,
  map,
  shareReplay,
  switchMap,
} from 'rxjs';
import { ApiService } from './api.service';
import { APISchemas } from './openapi';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _loading$ = new BehaviorSubject<boolean>(true);
  readonly loading$ = this._loading$.asObservable();

  private _authenticated$ = new BehaviorSubject<boolean>(false);
  readonly authenticated$ = this._authenticated$.asObservable();

  readonly user$: Observable<APISchemas['AuthUser'] | null> = combineLatest([
    this.loading$,
    this.authenticated$,
  ]).pipe(
    distinctUntilChanged(),
    switchMap(([loading, authenticated]) =>
      !loading && authenticated ? this._api.getCurrentUser() : of(null)
    ),
    shareReplay(1)
  );

  readonly active$: Observable<boolean> = this.user$.pipe(
    map((user) => user?.enabled ?? false)
  );

  readonly administrator$ = this.user$.pipe(
    map((user) => (user?.enabled ?? false) && (user?.admin ?? false))
  );

  private navigateToLoginPage() {
    // TODO: Remember current URL
    this._router.navigateByUrl('/should-login');
  }

  constructor(
    private _oauth: OAuthService,
    private _router: Router,
    private _api: ApiService
  ) {
    // Useful for debugging:
    this._oauth.events.subscribe((event) => {
      if (event instanceof OAuthErrorEvent) {
        console.error('OAuthErrorEvent Object:', event);
      } else {
        console.warn('OAuthEvent Object:', event);
      }
    });

    // This is tricky, as it might cause race conditions (where access_token is set in another
    // tab before everything is said and done there.
    // TODO: Improve this setup. See: https://github.com/jeroenheijmans/sample-angular-oauth2-oidc-with-auth-guards/issues/2
    window.addEventListener('storage', (event) => {
      // The `key` is `null` if the event was caused by `.clear()`
      if (event.key !== 'access_token' && event.key !== null) {
        return;
      }

      console.warn(
        'Noticed changes to access_token (most likely from another tab), updating isAuthenticated'
      );
      this._authenticated$.next(this._oauth.hasValidAccessToken());

      if (!this._oauth.hasValidAccessToken()) {
        this.navigateToLoginPage();
      }
    });

    this._oauth.events.subscribe((_) => {
      this._authenticated$.next(this._oauth.hasValidAccessToken());
    });
    this._authenticated$.next(this._oauth.hasValidAccessToken());

    this._oauth.events
      .pipe(filter((e) => ['token_received'].includes(e.type)))
      .subscribe((e) => this._oauth.loadUserProfile());

    this._oauth.events
      .pipe(
        filter((e) => ['session_terminated', 'session_error'].includes(e.type))
      )
      .subscribe((e) => this.navigateToLoginPage());

    this._oauth.setupAutomaticSilentRefresh();
  }

  public runInitialLoginSequence(): Promise<void> {
    if (location.hash) {
      console.log('Encountered hash fragment, plotting as table...');
      console.table(
        location.hash
          .substr(1)
          .split('&')
          .map((kvp) => kvp.split('='))
      );
    }

    // 0. LOAD CONFIG:
    // First we have to check to see how the IdServer is
    // currently configured:
    return (
      this._oauth
        .loadDiscoveryDocument()

        // For demo purposes, we pretend the previous call was very slow
        .then(
          () =>
            new Promise<void>((resolve) => setTimeout(() => resolve(), 1500))
        )

        // 1. HASH LOGIN:
        // Try to log in via hash fragment after redirect back
        // from IdServer from initImplicitFlow:
        .then(() => this._oauth.tryLogin())

        .then(() => {
          if (this._oauth.hasValidAccessToken()) {
            return Promise.resolve();
          }

          // 2. SILENT LOGIN:
          // Try to log in via a refresh because then we can prevent
          // needing to redirect the user:
          return this._oauth
            .silentRefresh()
            .then(() => Promise.resolve())
            .catch((result) => {
              // Subset of situations from https://openid.net/specs/openid-connect-core-1_0.html#AuthError
              // Only the ones where it's reasonably sure that sending the
              // user to the IdServer will help.
              const errorResponsesRequiringUserInteraction = [
                'interaction_required',
                'login_required',
                'account_selection_required',
                'consent_required',
              ];

              if (
                result &&
                result.reason &&
                errorResponsesRequiringUserInteraction.indexOf(
                  result.reason.error
                ) >= 0
              ) {
                // 3. ASK FOR LOGIN:
                // At this point we know for sure that we have to ask the
                // user to log in, so we redirect them to the IdServer to
                // enter credentials.
                //
                // Enable this to ALWAYS force a user to login.
                // this.login();
                //
                // Instead, we'll now do this:
                console.warn(
                  'User interaction is needed to log in, we will wait for the user to manually log in.'
                );
                return Promise.resolve();
              }

              // We can't handle the truth, just pass on the problem to the
              // next handler.
              return Promise.reject(result);
            });
        })

        .then(() => {
          this._loading$.next(false);

          // Check for the strings 'undefined' and 'null' just to be sure. Our current
          // login(...) should never have this, but in case someone ever calls
          // initImplicitFlow(undefined | null) this could happen.
          if (
            this._oauth.state &&
            this._oauth.state !== 'undefined' &&
            this._oauth.state !== 'null'
          ) {
            let stateUrl = this._oauth.state;
            if (stateUrl.startsWith('/') === false) {
              stateUrl = decodeURIComponent(stateUrl);
            }
            console.log(
              `There was state of ${this._oauth.state}, so we are sending you to: ${stateUrl}`
            );
            this._router.navigateByUrl(stateUrl);
          }
        })
        .catch(() => this._loading$.next(false))
    );
  }

  public allowed$(action: string) {
    return this.user$.pipe(
      map((user) => {
        if (!user?.enabled) {
          return false;
        }

        if (user.admin) {
          return true;
        }

        return !!user.actions && user.actions.indexOf(action) !== -1;
      })
    );
  }

  public login(targetUrl?: string) {
    // Note: before version 9.1.0 of the library you needed to
    // call encodeURIComponent on the argument to the method.
    this._oauth.initLoginFlow(targetUrl || this._router.url);
  }

  public logout() {
    this._oauth.logOut();
  }

  public refresh() {
    this._oauth.silentRefresh();
  }
}
