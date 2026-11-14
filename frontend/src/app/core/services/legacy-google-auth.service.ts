import {
  ClassProvider,
  Inject,
  Injectable,
  NgZone,
  OnDestroy,
  inject,
} from '@angular/core';
import { Subject } from 'rxjs';
import {
  WithGoogleAuthConfig,
  WithGoogleAuthIdToken,
  WithGoogleAuthService,
} from 'ngx-sign-in-with-google';

const storageKeys = {
  identity: 'WithGoogleAuth.IdToken',
  access: 'WithGoogleAuth.AccessToken',
  expiration: 'WithGoogleAuth.AccessTokenExpirationTimestamp',
};

/**
 * Keeps the existing Google button/storage contract while replacing the library's
 * premature login event. Only the server may authenticate the returned token;
 * the decoded ID-token fields are used solely as Google's account hint.
 */
@Injectable()
export class LegacyGoogleAuthService
  implements Pick<WithGoogleAuthService, keyof WithGoogleAuthService>, OnDestroy
{
  private readonly zone = inject(NgZone);
  private readonly events = new Subject<{ event: 'login' | 'logout' }>();
  private identity?: WithGoogleAuthIdToken;
  private accessToken?: string;
  private renewal?: ReturnType<typeof setTimeout>;
  private attempt = 0;

  constructor(
    @Inject('WithGoogleAuthConfig')
    private readonly config: WithGoogleAuthConfig,
  ) {
    this.restore();
  }

  _getButtonConfig() {
    return this.config.buttonConfig;
  }
  _getClientId() {
    return this.config.clientId;
  }
  _getEnableOneTap() {
    return this.config.enableOneTap;
  }
  getIdToken() {
    return this.identity;
  }
  getAccessToken() {
    return this.accessToken;
  }
  getEventSubject() {
    return this.events;
  }

  idTokenCallback(identity: WithGoogleAuthIdToken): void {
    this.attempt++;
    const hadToken = !!this.accessToken;
    this.clearAccessToken();
    this.identity = identity;
    this.store(storageKeys.identity, JSON.stringify(identity));
    if (hadToken) this.events.next({ event: 'logout' });
    this.requestNewAccessToken();
  }

  requestNewAccessToken(): void {
    const attempt = ++this.attempt;
    const fail = () =>
      this.zone.run(() => {
        if (attempt !== this.attempt) return;
        this.attempt++;
        this.clearAccessToken();
        this.events.next({ event: 'logout' });
      });
    try {
      // A separate callback per attempt prevents an earlier popup/account from
      // replacing a newer selection or restoring a logged-out session.
      const client = google.accounts.oauth2.initTokenClient({
        client_id: this.config.clientId,
        scope: this.config.scopes,
        callback: (response) =>
          this.zone.run(() => {
            if (attempt !== this.attempt) return;
            const expiresIn = Number(response.expires_in);
            if (
              response.error ||
              !response.access_token ||
              !Number.isFinite(expiresIn) ||
              expiresIn <= 0
            ) {
              fail();
              return;
            }
            this.attempt++;
            this.clearAccessToken();
            this.accessToken = response.access_token;
            this.store(storageKeys.access, this.accessToken);
            this.store(
              storageKeys.expiration,
              String(Math.floor(Date.now() / 1000) + expiresIn),
            );
            this.scheduleRenewal(expiresIn);
            this.events.next({ event: 'login' });
          }),
        error_callback: fail,
      });
      client.requestAccessToken({ hint: this.identity?.email, prompt: '' });
    } catch {
      fail();
    }
  }

  logout(): void {
    const token = this.accessToken;
    const email = this.identity?.email;
    this.attempt++;
    this.clearAccessToken();
    this.identity = undefined;
    this.store(storageKeys.identity, null);
    this.events.next({ event: 'logout' });
    // Local logout must succeed even if Google is unavailable.
    try {
      if (token) google.accounts.oauth2.revoke(token, () => {});
      if (email) google.accounts.id.revoke(email, () => {});
    } catch {
      /* The local credentials and pending callbacks are already cleared. */
    }
  }

  ngOnDestroy(): void {
    this.attempt++;
    clearTimeout(this.renewal);
    this.events.complete();
  }

  private restore(): void {
    let stored: string | null;
    let expiresIn: number;
    try {
      const identity: unknown = JSON.parse(
        localStorage.getItem(storageKeys.identity) ?? 'null',
      );
      if (
        identity &&
        typeof identity === 'object' &&
        !Array.isArray(identity)
      ) {
        this.identity = identity;
      }
      stored = localStorage.getItem(storageKeys.access);
      expiresIn =
        Number(localStorage.getItem(storageKeys.expiration)) -
        Date.now() / 1000;
    } catch {
      this.store(storageKeys.identity, null);
      this.clearAccessToken();
      return;
    }
    if (
      this.identity &&
      stored &&
      Number.isFinite(expiresIn) &&
      expiresIn > 0
    ) {
      this.accessToken = stored;
      this.scheduleRenewal(expiresIn);
    } else {
      this.clearAccessToken();
      if (this.identity) this.requestNewAccessToken();
    }
  }

  private scheduleRenewal(expiresIn: number): void {
    clearTimeout(this.renewal);
    this.renewal = setTimeout(
      () =>
        this.zone.run(() => {
          this.clearAccessToken();
          this.events.next({ event: 'logout' });
          this.requestNewAccessToken();
        }),
      expiresIn * 1000,
    );
  }

  private clearAccessToken(): void {
    clearTimeout(this.renewal);
    this.accessToken = undefined;
    this.store(storageKeys.access, null);
    this.store(storageKeys.expiration, null);
  }

  private store(key: string, value: string | null): void {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      /* A blocked storage must not prevent login in the current tab. */
    }
  }
}

export const LEGACY_GOOGLE_AUTH_PROVIDER: ClassProvider = {
  provide: WithGoogleAuthService,
  useClass: LegacyGoogleAuthService,
};
