import {
  provideHttpClient,
  withInterceptorsFromDi,
  HTTP_INTERCEPTORS,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { WithGoogleAuthService } from 'ngx-sign-in-with-google';
import { Subject, firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService, AUTH_NAVIGATE } from './auth.service';
import { ApiService } from './api.service';
import { AuthInterceptor } from '../interceptors/auth-interceptor';
import { NotificationsService } from 'src/app/shared/services/notifications.service';

describe('OIDC browser session and legacy Google transition', () => {
  let http: HttpTestingController;
  let auth: AuthService;
  let navigate: ReturnType<typeof vi.fn>;
  let googleFactory: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    navigate = vi.fn();
    googleFactory = vi.fn(() => {
      throw new Error('OIDC must not instantiate the Google widget');
    });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
        { provide: AUTH_NAVIGATE, useValue: navigate },
        { provide: WithGoogleAuthService, useFactory: googleFactory },
        { provide: NotificationsService, useValue: {} },
      ],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    document.cookie = 'XSRF-TOKEN=; Max-Age=0; Path=/';
    window.history.replaceState(null, '', '/');
  });

  function oidc() {
    auth.init();
    http
      .expectOne('/api/auth/config')
      .flush({
        mode: 'oidc',
        label: 'Keycloak local',
        login_url: '/api/auth/login',
      });
    return http.expectOne('/api/auth/me');
  }

  it('restores a session without exposing an ID/access token to Angular', async () => {
    const request = oidc();
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({
      id: 'user-test',
      enabled: true,
      admin: false,
      actions: ['budget.CreatePayment'],
    });
    expect(await firstValueFrom(auth.active$)).toBe(true);
    expect(await firstValueFrom(auth.allowed$('budget.CreatePayment'))).toBe(
      true
    );
    expect(await firstValueFrom(auth.allowed$('budget.DeletePayment'))).toBe(
      false
    );
    expect(await firstValueFrom(auth.token$)).toBeUndefined();
    expect(googleFactory).not.toHaveBeenCalled();
  });

  it('treats a missing session as logged out, without an endless retry', async () => {
    oidc().flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(await firstValueFrom(auth.authenticated$)).toBe(false);
    expect(await firstValueFrom(auth.loading$)).toBe(false);
    expect(await firstValueFrom(auth.message$)).toBeNull();
    auth.init();
    http.expectNone('/api/auth/config');
  });

  it('does not grant permissions to an inactive account, even with an admin flag', async () => {
    oidc().flush({
      enabled: false,
      admin: true,
      actions: ['budget.CreatePayment'],
    });
    expect(await firstValueFrom(auth.authenticated$)).toBe(true);
    expect(await firstValueFrom(auth.active$)).toBe(false);
    expect(await firstValueFrom(auth.administrator$)).toBe(false);
    expect(await firstValueFrom(auth.allowed$('budget.CreatePayment'))).toBe(
      false
    );
  });

  it('preserves the current route when starting sign-in', () => {
    oidc().flush({}, { status: 401, statusText: 'Unauthorized' });
    window.history.replaceState(null, '', '/budgets/budget-test');
    auth.login();
    const url = new URL(navigate.mock.calls[0][0]);
    expect(url.origin).toBe(window.location.origin);
    expect(url.pathname).toBe('/api/auth/login');
    expect(url.searchParams.get('return_to')).toBe('/budgets/budget-test');
  });

  it('sends Angular’s CSRF header on logout and clears the local user after revocation', async () => {
    oidc().flush({ id: 'user-test', enabled: true });
    document.cookie = 'XSRF-TOKEN=local-test-csrf; Path=/';
    auth.logout().subscribe();
    const request = http.expectOne('/api/auth/logout');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('X-XSRF-TOKEN')).toBe('local-test-csrf');
    request.flush({ redirect_url: 'http://localhost:9080/logout' });
    expect(await firstValueFrom(auth.authenticated$)).toBe(false);
    expect(navigate).toHaveBeenCalledWith('http://localhost:9080/logout');
  });

  it('removes permissions and shows a message when an application session expires', async () => {
    oidc().flush({ id: 'user-test', enabled: true, admin: true });
    TestBed.inject(ApiService)
      .listBudgets()
      .subscribe({ error: () => {} });
    http
      .expectOne('/api/budget')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(await firstValueFrom(auth.administrator$)).toBe(false);
    expect(await firstValueFrom(auth.message$)).toContain('expiré');
  });

  it('fails closed when authentication configuration cannot be loaded', async () => {
    auth.init();
    http
      .expectOne('/api/auth/config')
      .flush({}, { status: 503, statusText: 'Unavailable' });
    expect(await firstValueFrom(auth.message$)).toContain('indisponible');
    expect(await firstValueFrom(auth.active$)).toBe(false);
    expect(googleFactory).not.toHaveBeenCalled();
    http.expectNone('/api/auth/me');
  });

  it('keeps the existing Google access-token mode working until explicit production migration', async () => {
    googleFactory.mockImplementation(() => ({
      getEventSubject: () => new Subject(),
      getAccessToken: () => 'test-google-access-token',
    }));
    auth.init();
    http
      .expectOne('/api/auth/config')
      .flush({ mode: 'google', label: 'Google' });
    const request = http.expectOne('/api/auth/me');
    expect(request.request.headers.get('Authorization')).toBe(
      'Bearer test-google-access-token'
    );
    request.flush({ enabled: true, admin: true });
    expect(await firstValueFrom(auth.administrator$)).toBe(true);
    expect(googleFactory).toHaveBeenCalledOnce();
  });
});
