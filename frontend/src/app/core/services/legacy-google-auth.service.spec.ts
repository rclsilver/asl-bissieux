import {
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  WithGoogleAuthConfig,
  WithGoogleAuthModule,
  WithGoogleAuthService,
} from 'ngx-sign-in-with-google';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthInterceptor } from '../interceptors/auth-interceptor';
import { NotificationsService } from '../../shared/services/notifications.service';
import { AuthService } from './auth.service';
import { LEGACY_GOOGLE_AUTH_PROVIDER } from './legacy-google-auth.service';

const config: WithGoogleAuthConfig = {
  clientId: 'test-client',
  scopes: 'openid profile email',
  prompt: 'none',
  enableOneTap: false,
  buttonConfig: { type: 'standard' },
  interceptUrlPrefixes: [],
};

@Component({
  template: '<with-google-auth-button></with-google-auth-button>',
  standalone: false,
})
class GoogleButtonHost {}

describe('legacy Google token delivery', () => {
  let callbacks: google.accounts.oauth2.TokenClientConfig[];
  let requestToken: ReturnType<typeof vi.fn>;
  let service: WithGoogleAuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    callbacks = [];
    requestToken = vi.fn();
    vi.stubGlobal('google', {
      accounts: {
        oauth2: {
          initTokenClient: vi.fn((options) => {
            callbacks.push(options);
            return { requestAccessToken: requestToken };
          }),
          revoke: vi.fn(),
        },
        id: { revoke: vi.fn(), initialize: vi.fn(), renderButton: vi.fn() },
      },
    });
    TestBed.configureTestingModule({
      imports: [WithGoogleAuthModule],
      declarations: [GoogleButtonHost],
      providers: [
        LEGACY_GOOGLE_AUTH_PROVIDER,
        { provide: 'WithGoogleAuthConfig', useValue: config },
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
        { provide: NotificationsService, useValue: {} },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
    localStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function start() {
    const auth = TestBed.inject(AuthService);
    auth.init();
    http
      .expectOne('/api/auth/config')
      .flush({ mode: 'google', label: 'Google' });
    service = TestBed.inject(WithGoogleAuthService);
    return auth;
  }

  function receive(token: string, index = callbacks.length - 1) {
    callbacks[index].callback({
      access_token: token,
      expires_in: 3600,
    } as unknown as google.accounts.oauth2.TokenResponse);
  }

  function expectSession(token: string) {
    const request = http.expectOne('/api/auth/me');
    expect(request.request.headers.get('Authorization')).toBe(
      `Bearer ${token}`,
    );
    request.flush({ id: 'test-user', enabled: true, admin: false });
  }

  it('loads the account only after the first asynchronous access token arrives', async () => {
    const auth = start();
    service.idTokenCallback({ email: 'test@example.invalid' });
    http.expectNone('/api/auth/me');
    expect(await firstValueFrom(auth.authenticated$)).toBe(false);
    receive('first-test-token');
    expectSession('first-test-token');
    expect(await firstValueFrom(auth.active$)).toBe(true);
  });

  it('uses the replacement service through the unchanged library button', () => {
    start();
    const fixture = TestBed.createComponent(GoogleButtonHost);
    fixture.detectChanges();
    const options = vi.mocked(google.accounts.id.initialize).mock.calls[0][0];
    expect(options.client_id).toBe(config.clientId);
    expect(google.accounts.id.renderButton).toHaveBeenCalledWith(
      fixture.nativeElement.querySelector('with-google-auth-button'),
      config.buttonConfig,
    );
    const payload = btoa(JSON.stringify({ email: 'test@example.invalid' }));
    options.callback!({
      credential: `unused.${payload}.unused`,
    } as google.accounts.id.CredentialResponse);
    http.expectNone('/api/auth/me');
    receive('button-test-token');
    expectSession('button-test-token');
    fixture.destroy();
  });

  it('updates the application and its Authorization header when a token is renewed', async () => {
    const auth = start();
    service.idTokenCallback({ email: 'test@example.invalid' });
    receive('first-test-token');
    expectSession('first-test-token');
    vi.advanceTimersByTime(3600_000);
    expect(requestToken).toHaveBeenCalledTimes(2);
    receive('renewed-test-token');
    expectSession('renewed-test-token');
    expect(await firstValueFrom(auth.token$)).toBe('renewed-test-token');
  });

  it('restores an existing valid token without another Google interaction', () => {
    localStorage.setItem(
      'WithGoogleAuth.IdToken',
      JSON.stringify({ email: 'test@example.invalid' }),
    );
    localStorage.setItem('WithGoogleAuth.AccessToken', 'stored-test-token');
    localStorage.setItem(
      'WithGoogleAuth.AccessTokenExpirationTimestamp',
      String(Date.now() / 1000 + 3600),
    );
    start();
    expectSession('stored-test-token');
    expect(requestToken).not.toHaveBeenCalled();
    expect(service._getClientId()).toBe(config.clientId);
    expect(service._getButtonConfig()).toEqual(config.buttonConfig);
    expect(service._getEnableOneTap()).toBe(false);
  });

  it('waits for replacement of an expired stored token instead of sending it to the API', () => {
    localStorage.setItem(
      'WithGoogleAuth.IdToken',
      JSON.stringify({ email: 'test@example.invalid' }),
    );
    localStorage.setItem('WithGoogleAuth.AccessToken', 'expired-test-token');
    localStorage.setItem('WithGoogleAuth.AccessTokenExpirationTimestamp', '1');
    start();
    http.expectNone('/api/auth/me');
    expect(service.getAccessToken()).toBeUndefined();
    receive('replacement-test-token');
    expectSession('replacement-test-token');
  });

  it('ignores a token response received after logout and cancels renewal', async () => {
    const auth = start();
    service.idTokenCallback({ email: 'test@example.invalid' });
    service.logout();
    receive('late-test-token');
    http.expectNone('/api/auth/me');
    expect(service.getAccessToken()).toBeUndefined();
    expect(localStorage.getItem('WithGoogleAuth.AccessToken')).toBeNull();
    expect(await firstValueFrom(auth.authenticated$)).toBe(false);
    vi.advanceTimersByTime(3600_000);
    expect(requestToken).toHaveBeenCalledTimes(1);
  });

  it('cancels account validation still in flight when logging out', async () => {
    const auth = start();
    service.idTokenCallback({ email: 'test@example.invalid' });
    receive('first-test-token');
    const pending = http.expectOne('/api/auth/me');
    service.logout();
    expect(pending.cancelled).toBe(true);
    expect(await firstValueFrom(auth.active$)).toBe(false);
  });

  it('cancels validation of the old account when selecting a different account', () => {
    start();
    service.idTokenCallback({ email: 'first@example.invalid' });
    receive('first-test-token');
    const pending = http.expectOne('/api/auth/me');
    service.idTokenCallback({ email: 'second@example.invalid' });
    expect(pending.cancelled).toBe(true);
    receive('second-test-token');
    expectSession('second-test-token');
  });

  it('does not use the previous account token when selecting another Google account', async () => {
    const auth = start();
    service.idTokenCallback({ email: 'first@example.invalid' });
    receive('first-test-token');
    expectSession('first-test-token');
    service.idTokenCallback({ email: 'second@example.invalid' });
    http.expectNone('/api/auth/me');
    expect(await firstValueFrom(auth.token$)).toBeUndefined();
    receive('second-test-token');
    expectSession('second-test-token');
  });

  it('discards a callback from an earlier account selection', () => {
    start();
    service.idTokenCallback({ email: 'first@example.invalid' });
    const firstRequest = callbacks.length - 1;
    service.idTokenCallback({ email: 'second@example.invalid' });
    receive('stale-test-token', firstRequest);
    http.expectNone('/api/auth/me');
    expect(service.getAccessToken()).toBeUndefined();
    receive('second-test-token');
    expectSession('second-test-token');
  });

  it('clears the account after an OAuth error instead of retaining a rejected token', async () => {
    const auth = start();
    service.idTokenCallback({ email: 'test@example.invalid' });
    receive('first-test-token');
    expectSession('first-test-token');
    service.requestNewAccessToken();
    callbacks
      .at(-1)!
      .callback({
        error: 'access_denied',
      } as google.accounts.oauth2.TokenResponse);
    expect(await firstValueFrom(auth.token$)).toBeUndefined();
    expect(service.getAccessToken()).toBeUndefined();
    expect(await firstValueFrom(auth.authenticated$)).toBe(false);
  });

  it('handles a blocked or closed popup without accepting a late callback', () => {
    start();
    service.idTokenCallback({ email: 'test@example.invalid' });
    const request = callbacks.at(-1)!;
    expect(request.error_callback).toBeDefined();
    request.error_callback!({
      type: 'popup_closed',
      name: 'popup_closed',
      message: 'Popup closed',
    });
    receive('late-test-token');
    http.expectNone('/api/auth/me');
    expect(service.getAccessToken()).toBeUndefined();
  });

  it('tolerates malformed legacy storage', () => {
    localStorage.setItem('WithGoogleAuth.IdToken', '{broken');
    start();
    expect(service.getAccessToken()).toBeUndefined();
    http.expectNone('/api/auth/me');
  });

  it('can connect in the current tab when browser storage is blocked', () => {
    for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw new DOMException('Storage is blocked', 'SecurityError');
      });
    }
    start();
    service.idTokenCallback({ email: 'test@example.invalid' });
    receive('memory-only-test-token');
    expectSession('memory-only-test-token');
  });
});
