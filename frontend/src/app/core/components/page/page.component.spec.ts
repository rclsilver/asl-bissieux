import {
  HTTP_INTERCEPTORS,
  HttpClient,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Component, provideZoneChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter, Router, withHashLocation } from '@angular/router';
import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { MatSidenav } from '@angular/material/sidenav';
import { By } from '@angular/platform-browser';
import { BehaviorSubject } from 'rxjs';
import { WithGoogleAuthService } from 'ngx-sign-in-with-google';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoreModule } from '../../core.module';
import { AuthInterceptor } from '../../interceptors/auth-interceptor';
import { AUTH_NAVIGATE } from '../../services/auth.service';
import { PageComponent } from './page.component';

@Component({ template: '<h1>Contenu de test</h1>' })
class TestContent {}

describe('OIDC sign-in page', () => {
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.fn>;

  let handset: BehaviorSubject<BreakpointState>;

  beforeEach(async () => {
    handset = new BehaviorSubject<BreakpointState>({
      matches: false,
      breakpoints: {},
    });
    navigate = vi.fn();
    await TestBed.configureTestingModule({
      imports: [CoreModule, NoopAnimationsModule],
      providers: [
        provideRouter(
          ['budgets', 'units', 'members', 'emails', 'users'].map((path) => ({
            path,
            component: TestContent,
          })),
          withHashLocation()
        ),
        {
          provide: BreakpointObserver,
          useValue: { observe: () => handset.asObservable() },
        },
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
  afterEach(() => {
    http.verify();
    window.history.replaceState(null, '', '/');
  });

  it('shows an enabled sign-in button after an unauthenticated session check', async () => {
    const fixture = TestBed.createComponent(PageComponent);
    fixture.detectChanges();
    http.expectOne('/api/auth/config').flush({
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
      (button) => button.textContent?.trim() === 'Continuer avec Keycloak local'
    );
    expect(login).toBeDefined();
    expect(login!.closest('.auth-panel')).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('#top-menu .sign-in')
    ).toBeNull();
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
    http.expectOne('/api/auth/me').flush({
      username: 'pending@example.invalid',
      access_status: 'pending',
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
      Array.from(fixture.nativeElement.querySelectorAll('button')).some(
        (button) =>
          (button as HTMLButtonElement).textContent?.includes('Se déconnecter')
      )
    ).toBe(true);
  });
  it.each([
    ['disabled', 'Accès désactivé'],
    ['rejected', 'Accès refusé'],
  ])(
    'distinguishes %s from pending approval and can refresh access',
    async (status, title) => {
      const fixture = TestBed.createComponent(PageComponent);
      fixture.detectChanges();
      http
        .expectOne('/api/auth/config')
        .flush({ mode: 'oidc', login_url: '/api/auth/login' });
      http
        .expectOne('/api/auth/me')
        .flush({
          username: 'inactive@example.invalid',
          enabled: false,
          admin: false,
          access_status: status,
        });
      fixture.detectChanges();
      await fixture.whenStable();
      expect(fixture.nativeElement.textContent).toContain(title);
      expect(fixture.nativeElement.textContent).not.toContain(
        'Compte en attente'
      );
      fixture.componentInstance.refreshAccess();
      fixture.componentInstance.refreshAccess();
      http
        .expectOne('/api/auth/me')
        .flush({
          username: 'inactive@example.invalid',
          enabled: true,
          admin: false,
          access_status: 'active',
        });
      fixture.detectChanges();
      await fixture.whenStable();
      expect(fixture.nativeElement.querySelector('.auth-panel')).toBeNull();
    }
  );
  it('names Google while retaining the server-side OIDC sign-in path', async () => {
    const fixture = TestBed.createComponent(PageComponent);
    fixture.detectChanges();
    http
      .expectOne('/api/auth/config')
      .flush({ mode: 'oidc', label: 'Google', login_url: '/api/auth/login' });
    http
      .expectOne('/api/auth/me')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();
    await fixture.whenStable();
    const login = fixture.nativeElement.querySelector(
      '.auth-panel .sign-in'
    ) as HTMLButtonElement;
    expect(login.textContent).toContain('Continuer avec Google');
    expect(
      fixture.nativeElement.querySelector('with-google-auth-button')
    ).toBeNull();
    login.click();
    expect(new URL(navigate.mock.calls[0][0]).pathname).toBe('/api/auth/login');
  });

  it('waits for session verification before offering sign-in', async () => {
    const fixture = TestBed.createComponent(PageComponent);
    fixture.detectChanges();
    http
      .expectOne('/api/auth/config')
      .flush({ mode: 'oidc', label: 'Google', login_url: '/api/auth/login' });
    const me = http.expectOne('/api/auth/me');
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[role="status"]').textContent
    ).toContain('Vérification');
    expect(fixture.nativeElement.querySelector('.sign-in')).toBeNull();
    me.flush({}, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.sign-in')).not.toBeNull();
  });

  it('offers recovery instead of a dead sign-in action when configuration is unavailable', async () => {
    const fixture = TestBed.createComponent(PageComponent);
    fixture.detectChanges();
    http
      .expectOne('/api/auth/config')
      .flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('h1').textContent).toContain(
      'Connexion indisponible'
    );
    expect(
      fixture.nativeElement.querySelector('[role="alert"]').textContent
    ).toContain('Recharge');
    expect(fixture.nativeElement.querySelector('.sign-in')).toBeNull();
    const recovery = Array.from(
      fixture.nativeElement.querySelectorAll('button')
    ) as HTMLButtonElement[];
    expect(
      recovery.some((button) =>
        button.textContent?.includes('Recharger la page')
      )
    ).toBe(true);
  });
  function authenticated(admin = false, username = 'reader@example.invalid') {
    const fixture = TestBed.createComponent(PageComponent);
    fixture.detectChanges();
    http
      .expectOne('/api/auth/config')
      .flush({ mode: 'oidc', label: 'Google', login_url: '/api/auth/login' });
    http.expectOne('/api/auth/me').flush({ username, enabled: true, admin });
    fixture.detectChanges();
    return fixture;
  }

  it('does not offer an empty mobile drawer before sign-in', async () => {
    handset.next({ matches: true, breakpoints: {} });
    const fixture = TestBed.createComponent(PageComponent);
    fixture.detectChanges();
    http
      .expectOne('/api/auth/config')
      .flush({ mode: 'oidc', login_url: '/api/auth/login' });
    http
      .expectOne('/api/auth/me')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(
      fixture.nativeElement.querySelector(
        'button[aria-controls="primary-navigation"]'
      )
    ).toBeNull();
    expect(
      fixture.debugElement.query(By.directive(MatSidenav)).componentInstance
        .opened
    ).toBe(false);
  });

  it('navigates from the mobile drawer, marks the destination and closes the drawer', async () => {
    handset.next({ matches: true, breakpoints: {} });
    const fixture = authenticated();
    await fixture.whenStable();
    const menu = fixture.nativeElement.querySelector(
      'button[aria-controls="primary-navigation"]'
    ) as HTMLButtonElement;
    menu.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const drawer = fixture.debugElement.query(By.directive(MatSidenav))
      .componentInstance as MatSidenav;
    expect(drawer.opened).toBe(true);
    expect(menu.getAttribute('aria-expanded')).toBe('true');
    const members = Array.from(
      fixture.nativeElement.querySelectorAll('#left-menu a')
    ).find((link) =>
      (link as HTMLElement).textContent?.includes('Membres')
    ) as HTMLAnchorElement;
    members.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/members');
    expect(drawer.opened).toBe(false);
    expect(members.getAttribute('aria-current')).toBe('page');
    expect(menu.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes an open mobile drawer when a protected request expires the session', async () => {
    handset.next({ matches: true, breakpoints: {} });
    const fixture = authenticated();
    await fixture.whenStable();
    fixture.nativeElement
      .querySelector('button[aria-controls="primary-navigation"]')
      .click();
    fixture.detectChanges();
    await fixture.whenStable();
    const drawer = fixture.debugElement.query(By.directive(MatSidenav))
      .componentInstance as MatSidenav;
    expect(drawer.opened).toBe(true);

    TestBed.inject(HttpClient)
      .get('/api/budget')
      .subscribe({ error: () => {} });
    http
      .expectOne('/api/budget')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(drawer.opened).toBe(false);
    expect(
      fixture.nativeElement.querySelector('.sign-in')?.textContent
    ).toContain('Continuer avec Google');
    expect(
      fixture.nativeElement.querySelector('[role="alert"]')?.textContent
    ).toContain('Ta session a expiré');
    expect(
      fixture.nativeElement.querySelector(
        'button[aria-controls="primary-navigation"]'
      )
    ).toBeNull();
  });

  it('synchronizes a dismissed mobile drawer so it can reopen', async () => {
    handset.next({ matches: true, breakpoints: {} });
    const fixture = authenticated();
    await fixture.whenStable();
    const menu = fixture.nativeElement.querySelector(
      'button[aria-controls="primary-navigation"]'
    ) as HTMLButtonElement;
    menu.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const drawer = fixture.debugElement.query(By.directive(MatSidenav))
      .componentInstance as MatSidenav;
    expect(drawer.opened).toBe(true);
    fixture.nativeElement.querySelector('.mat-drawer-backdrop').click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(menu.getAttribute('aria-expanded')).toBe('false');
    expect(drawer.opened).toBe(false);
    menu.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(drawer.opened).toBe(true);
  });

  it('keeps desktop navigation open after selecting a destination', async () => {
    const fixture = authenticated();
    await fixture.whenStable();
    const links = Array.from(
      fixture.nativeElement.querySelectorAll('#left-menu a')
    ) as HTMLAnchorElement[];
    const members = links.find((link) =>
      link.textContent?.includes('Membres')
    )!;
    members.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/members');
    expect(
      fixture.debugElement.query(By.directive(MatSidenav)).componentInstance
        .opened
    ).toBe(true);
    expect(
      fixture.nativeElement.querySelector(
        'button[aria-controls="primary-navigation"]'
      )
    ).toBeNull();
    expect(
      links.some((link) => link.textContent?.includes('Utilisateurs'))
    ).toBe(false);
  });

  it('moves keyboard focus to main without changing the hash route', async () => {
    const fixture = authenticated();
    await TestBed.inject(Router).navigateByUrl('/budgets');
    fixture.detectChanges();
    await fixture.whenStable();
    const before = window.location.hash;
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    fixture.nativeElement.querySelector('.skip-link').dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(
      fixture.nativeElement.querySelector('main')
    );
    expect(TestBed.inject(Router).url).toBe('/budgets');
    expect(window.location.hash).toBe(before);
  });

  it('keeps the complete long account identity available and logs out through the account menu', async () => {
    handset.next({ matches: true, breakpoints: {} });
    const username = 'very-long-'.repeat(12) + '@example.invalid';
    const fixture = authenticated(false, username);
    await fixture.whenStable();
    const account = fixture.nativeElement.querySelector(
      '.account-menu-trigger'
    ) as HTMLButtonElement;
    expect(account.getAttribute('aria-label')).toContain(username);
    account.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.querySelector('.account-identity')?.textContent).toBe(
      username
    );
    const logout = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Se déconnecter')
    )!;
    logout.click();
    const request = http.expectOne('/api/auth/logout');
    expect(request.request.method).toBe('POST');
    request.flush({ redirect_url: '/' });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith('/');
    expect(
      fixture.nativeElement.querySelector('.account-menu-trigger')
    ).toBeNull();
    expect(fixture.nativeElement.querySelector('.sign-in')).not.toBeNull();
  });

  it('shows the French administration entry only to an active administrator', async () => {
    const fixture = authenticated(true);
    await fixture.whenStable();
    const text = fixture.nativeElement.querySelector('#left-menu').textContent;
    expect(text).toContain('Lots');
    expect(text).toContain('Membres');
    expect(text).toContain('Utilisateurs');
    expect(text).not.toContain('Members');
    expect(text).not.toContain('Users');
  });
});
