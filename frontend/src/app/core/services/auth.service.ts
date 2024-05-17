import { Injectable, inject } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  map,
  from,
  Subject,
  takeUntil,
} from 'rxjs';
import { ApiService } from './api.service';
import { APISchemas } from '../api/openapi';
import { WithGoogleAuthService } from 'ngx-sign-in-with-google';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _auth = inject(WithGoogleAuthService);
  private readonly _api = inject(ApiService);

  private _user$ = new BehaviorSubject<APISchemas['AuthUser'] | null>(null);
  readonly user$ = this._user$.asObservable();

  private _token$ = new BehaviorSubject<string | undefined>(undefined);
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
    });

    this._token$.subscribe((token) => {
      if (token) {
        this._api
          .getCurrentUser()
          .pipe(takeUntil(this.unauthenticated$))
          .subscribe((user) => this._user$.next(user));
      } else {
        this._unauthenticated$.next();
      }
    });

    this._auth.getEventSubject().subscribe(() => {
      this._token$.next(this._auth.getAccessToken());
    });

    this._token$.next(this._auth.getAccessToken());
  }

  public refresh() {
    return from((async () => this._auth.requestNewAccessToken())());
  }

  public logout() {
    return from((async () => this._auth.logout())());
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
