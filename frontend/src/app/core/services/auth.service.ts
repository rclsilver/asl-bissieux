import { Injectable, inject } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  map,
  from,
  takeUntil,
  Subject,
} from 'rxjs';
import { ApiService } from './api.service';
import { APISchemas } from '../api/openapi';
import {
  GoogleLoginProvider,
  SocialAuthService,
  SocialUser,
} from '@abacritt/angularx-social-login';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _auth = inject(SocialAuthService);
  private readonly _api = inject(ApiService);

  private _user$ = new BehaviorSubject<APISchemas['AuthUser'] | null>(null);
  readonly user$ = this._user$.asObservable();

  private _token$ = new BehaviorSubject<string | null>(null);
  readonly token$ = this._token$.asObservable();

  readonly authenticated$ = this.user$.pipe(map((user) => !!user));

  private _unauthenticated$ = new Subject<void>();
  readonly unauthenticated$ = this._unauthenticated$.asObservable();

  readonly active$: Observable<boolean> = this.user$.pipe(
    map((user) => user?.enabled ?? false)
  );

  readonly administrator$ = this.user$.pipe(
    map((user) => (user?.enabled ?? false) && (user?.admin ?? false))
  );

  public init() {
    this.unauthenticated$.subscribe(() => {
      this._user$.next(null);
      this._token$.next(null);
    });

    this._auth.authState.subscribe((state) => {
      if (state) {
        this._auth
          .getAccessToken(GoogleLoginProvider.PROVIDER_ID)
          .then((token) => {
            this._token$.next(token);

            this._api
              .getCurrentUser()
              .pipe(takeUntil(this.unauthenticated$))
              .subscribe((user) => this._user$.next(user));
          });
      } else {
        this._unauthenticated$.next();
      }
    });
  }

  public refresh() {
    return from(this._auth.refreshAccessToken(GoogleLoginProvider.PROVIDER_ID));
  }

  public logout() {
    return from(this._auth.signOut(true));
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
}
