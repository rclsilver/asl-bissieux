import { provideZoneChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthService } from '../core/services/auth.service';
import { DashboardModule } from './dashboard.module';
import { DashboardComponent } from './dashboard.component';

const unit = {
  id: 'unit',
  number: 12,
  address: 'Adresse fictive',
  members: [
    { id: 'one', first_name: 'Alice', last_name: 'Fixture' },
    { id: 'two', first_name: 'Bob', last_name: 'Fixture' },
  ],
};
function finance(id: string, label: string) {
  return {
    budget: { id, label, draft: false, amount: 100 },
    recovery: {
      called: 100,
      paid: 120,
      remaining: 0,
      surplus: 20,
      refunded: 0,
      rate: 100,
      lots: 1,
      settled: 1,
      partial: 0,
      unpaid: 0,
      overpaid: 1,
    },
    cotisations: [
      {
        id: 'call-' + id,
        unit,
        amount: 100,
        paid: 120,
        remaining: -20,
        payment_state: 4,
      },
    ],
    years: [2025, 2026],
    months: Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      payments: i === 0 ? 120 : 0,
      refunds: 0,
      net: i === 0 ? 120 : 0,
      cumulative: 120,
    })),
  };
}

describe('Dashboard scopes and recovery', () => {
  let http: HttpTestingController;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let admin: BehaviorSubject<boolean>;
  beforeEach(async () => {
    params = new BehaviorSubject(
      convertToParamMap({ budget: 'a', year: '2026' })
    );
    admin = new BehaviorSubject(false);
    await TestBed.configureTestingModule({
      imports: [DashboardModule, NoopAnimationsModule],
      providers: [
        provideZoneChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { queryParamMap: params } },
        { provide: AuthService, useValue: { administrator$: admin } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function setup(emailFailure = false) {
    const f = TestBed.createComponent(DashboardComponent);
    f.detectChanges();
    http.expectOne('/api/budget').flush([
      { id: 'a', label: 'Premier', draft: false },
      { id: 'b', label: 'Deuxième', draft: false },
    ]);
    http
      .expectOne('/api/unit')
      .flush([unit, { id: 'empty', number: 13, members: [] }]);
    http
      .expectOne('/api/dashboard/directory')
      .flush({ missing_email: 1, no_member: 1, invalid_shares: 0 });
    const email = http.expectOne('/api/dashboard/emails');
    if (emailFailure)
      email.flush({}, { status: 503, statusText: 'Unavailable' });
    else
      email.flush({
        counts: {
          total: 0,
          waiting: 0,
          sending: 0,
          successful: 0,
          error: 0,
          unknown: 0,
        },
        recent: [],
        campaigns: 0,
      });
    return f;
  }
  it('defers the no-call diagnostic until the lot catalogue has loaded', () => {
    params.next(convertToParamMap({ budget: 'a', year: '2026', lot: '13' }));
    const f = TestBed.createComponent(DashboardComponent);
    f.detectChanges();
    http
      .expectOne('/api/budget')
      .flush([{ id: 'a', label: 'Budget', draft: false }]);
    http.expectOne('/api/dashboard/directory').flush({});
    http.expectOne('/api/dashboard/emails').flush({ counts: {}, recent: [] });
    http
      .expectOne('/api/budget/a/dashboard?year=2026')
      .flush(finance('a', 'Budget'));
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain(
      'Chargement de la situation du lot'
    );
    expect(f.nativeElement.textContent).not.toContain(
      'ne correspond pas à un lot actif'
    );
    http
      .expectOne('/api/unit')
      .flush([{ id: 'empty', number: 13, members: [] }]);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain(
      'Aucune cotisation pour ce lot'
    );
  });
  it('cancels old budgets and years immediately while keeping global modules independent', () => {
    const f = setup(true);
    const old = http.expectOne('/api/budget/a/dashboard?year=2026');
    params.next(convertToParamMap({ budget: 'b', year: '2026' }));
    expect(old.cancelled).toBe(true);
    const next = http.expectOne('/api/budget/b/dashboard?year=2026');
    params.next(convertToParamMap({ budget: 'b', year: '2025' }));
    expect(next.cancelled).toBe(true);
    http
      .expectOne('/api/budget/b/dashboard?year=2025')
      .flush(finance('b', 'Budget actuel'));
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Budget actuel');
    expect(f.nativeElement.textContent).toContain(
      'La synthèse des e-mails est indisponible'
    );
    expect(() => old.flush(finance('a', 'Ancien budget'))).toThrow();
    expect(f.nativeElement.textContent).not.toContain('Ancien budget');
    f.componentInstance.retry('emails');
    http
      .expectOne('/api/dashboard/emails')
      .flush({
        counts: {
          total: 0,
          waiting: 0,
          sending: 0,
          successful: 0,
          error: 0,
          unknown: 0,
        },
        recent: [],
        campaigns: 0,
      });
    http.expectNone('/api/auth/access-requests/summary');
  });
  it('requests and displays access counts only while the user is an administrator', () => {
    const f = setup();
    http
      .expectOne('/api/budget/a/dashboard?year=2026')
      .flush(finance('a', 'Budget'));
    http.expectNone('/api/auth/access-requests/summary');
    admin.next(true);
    const request = http.expectOne('/api/auth/access-requests/summary');
    admin.next(false);
    expect(request.cancelled).toBe(true);
    f.detectChanges();
    expect(f.nativeElement.textContent).not.toContain(
      'Demandes d’accès — administration'
    );
    admin.next(true);
    http.expectOne('/api/auth/access-requests/summary').flush({ pending: 2 });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('2 demandes en attente');
  });
  it('loads only the selected lot payments, retries an error and distinguishes no call from no payment', () => {
    const f = setup();
    http
      .expectOne('/api/budget/a/dashboard?year=2026')
      .flush(finance('a', 'Budget'));
    params.next(convertToParamMap({ budget: 'a', year: '2026', lot: '12' }));
    http
      .expectOne('/api/budget/a/cotisations/call-a/payments')
      .flush({}, { status: 503, statusText: 'Unavailable' });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Alice Fixture');
    expect(f.nativeElement.textContent).toContain('Bob Fixture');
    expect(f.nativeElement.textContent).toContain('Trop-perçu à rembourser');
    f.componentInstance.retry('payments');
    http
      .expectOne('/api/budget/a/cotisations/call-a/payments')
      .flush([
        {
          id: 'p',
          date: '2026-01-31T23:30:00Z',
          amount: 120,
          comment: 'Paiement fictif',
        },
      ]);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('01/02/2026');
    params.next(convertToParamMap({ budget: 'a', year: '2026', lot: '13' }));
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain(
      'Aucune cotisation pour ce lot'
    );
    expect(f.nativeElement.textContent).not.toContain('Paiement fictif');
  });
  it('keeps a draft provisional and treats a zero reference without a misleading percentage', () => {
    const f = setup();
    http
      .expectOne('/api/budget/a/dashboard?year=2026')
      .flush({
        budget: {
          id: 'a',
          label: 'Brouillon',
          draft: true,
          amount: 120,
          preview: {
            amount: 120,
            total_shares: 4,
            months: 12,
            annual_per_share: 30,
            monthly_per_share: 2.5,
            ready: true,
          },
        },
        recovery: { called: 0, rate: null },
        cotisations: [],
        months: [],
        years: [2026],
      });
    params.next(
      convertToParamMap({ budget: 'a', year: '2026', reference: 'b' })
    );
    http
      .expectOne('/api/budget/b')
      .flush({ id: 'b', label: 'Référence nulle', draft: false, amount: 0 });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Prévisions uniquement');
    expect(f.nativeElement.textContent).toContain(
      'le pourcentage n’est pas calculé'
    );
    expect(f.nativeElement.textContent).toContain('n’ont pas été historisées');
    expect(f.nativeElement.querySelector('app-interactive-map')).toBeNull();
    expect(f.componentInstance.comparisonDifference).toBe(120);
    expect(f.componentInstance.comparisonPercent).toBeNull();
  });
});
