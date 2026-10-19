import {
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZoneChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { WithGoogleAuthService } from 'ngx-sign-in-with-google';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoreModule } from '../../core.module';
import { AuthInterceptor } from '../../interceptors/auth-interceptor';
import { AUTH_NAVIGATE } from '../../services/auth.service';
import { PageComponent } from './page.component';

describe('OIDC sign-in page', () => {
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    navigate = vi.fn();
    await TestBed.configureTestingModule({
      imports: [CoreModule, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        provideZoneChangeDetection(),
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
        { provide: AUTH_NAVIGATE, useValue: navigate },
        {
          provide: WithGoogleAuthService,
          useFactory: () => {
            throw new Error('Unexpected legacy Google widget');
          },
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('shows an enabled sign-in button after an unauthenticated session check', async () => {
    const fixture = TestBed.createComponent(PageComponent);
    fixture.detectChanges();
    http
      .expectOne('/api/auth/config')
      .flush({
        mode: 'oidc',
        login_url: '/api/auth/login',
        label: 'Keycloak local',
      });
    http
      .expectOne('/api/auth/me')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();
    await fixture.whenStable();
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button')
    ) as HTMLButtonElement[];
    const login = buttons.find(
      (button) => button.textContent?.trim() === 'Se connecter'
    );
    expect(login).toBeDefined();
    expect(login!.disabled).toBe(false);
    expect(
      fixture.nativeElement.querySelector('with-google-auth-button')
    ).toBeNull();
    login!.click();
    expect(new URL(navigate.mock.calls[0][0]).pathname).toBe('/api/auth/login');
  });

  it('shows the pending activation message without business navigation for an inactive account', async () => {
    const fixture = TestBed.createComponent(PageComponent);
    fixture.detectChanges();
    http
      .expectOne('/api/auth/config')
      .flush({ mode: 'oidc', login_url: '/api/auth/login' });
    http
      .expectOne('/api/auth/me')
      .flush({
        username: 'pending@example.invalid',
        enabled: false,
        admin: false,
      });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain(
      'Compte en attente d’activation'
    );
    expect(fixture.nativeElement.querySelectorAll('#left-menu a').length).toBe(
      0
    );
    expect(
      fixture.nativeElement.querySelector('button[aria-label="Logout"]')
    ).not.toBeNull();
  });
});
