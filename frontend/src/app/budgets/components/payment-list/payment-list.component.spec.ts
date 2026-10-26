import { CommonModule } from '@angular/common';
import { provideZoneChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { BehaviorSubject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { MatTabsModule } from '@angular/material/tabs';
import { AuthService } from 'src/app/core/services/auth.service';
import { SharedModule } from 'src/app/shared/shared.module';
import { NotificationsService } from 'src/app/shared/services/notifications.service';
import { FinancialHistoryComponent } from '../financial-history/financial-history.component';
import { ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  COTISATION_DIALOG_OPTIONS,
  PaymentListComponent,
} from './payment-list.component';
import { PaymentFormComponent } from '../payment-form/payment-form.component';

describe('Manage payments dialog', () => {
  let http: HttpTestingController;
  let handset: BehaviorSubject<BreakpointState>;

  beforeEach(async () => {
    handset = new BehaviorSubject<BreakpointState>({
      matches: false,
      breakpoints: {},
    });
    await TestBed.configureTestingModule({
      declarations: [PaymentListComponent, FinancialHistoryComponent],
      imports: [
        CommonModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatMenuModule,
        MatIconModule,
        MatTooltipModule,
        SharedModule,
        MatButtonModule,
        MatDialogModule,
        MatTabsModule,
        NoopAnimationsModule,
      ],
      providers: [
        provideZoneChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { allowed$: () => of(true) } },
        {
          provide: BreakpointObserver,
          useValue: { observe: () => handset.asObservable() },
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    TestBed.inject(MatDialog).closeAll();
    http.verify();
  });

  it('keeps the dialog closable after a budget loading error', () => {
    TestBed.inject(NotificationsService).showForm(PaymentListComponent, {
      ...COTISATION_DIALOG_OPTIONS,
      data: { budgetId: 'failed', cotisationId: 'call' },
    });
    TestBed.tick();
    http
      .expectOne('/api/budget/failed')
      .flush({}, { status: 500, statusText: 'Error' });
    TestBed.tick();
    const dialog = document.querySelector('mat-dialog-container');
    expect(dialog?.textContent).toContain('Réessayer');
    expect(dialog?.textContent).toContain('Fermer');
  });
  it('opens and renders the payments returned for the selected cotisation', async () => {
    TestBed.inject(NotificationsService).showForm(PaymentListComponent, {
      ...COTISATION_DIALOG_OPTIONS,
      data: { budgetId: 'budget-test', cotisationId: 'cotisation-test' },
    });
    TestBed.tick();
    http
      .expectOne('/api/budget/budget-test')
      .flush({ id: 'budget-test', draft: false });
    TestBed.tick();
    http.expectOne('/api/budget/budget-test/cotisations').flush([
      {
        id: 'cotisation-test',
        unit: { number: 12 },
        amount: 100,
        paid: 24.01,
        remaining: 75.99,
      },
    ]);
    http
      .expectOne('/api/budget/budget-test/cotisations/cotisation-test/entries')
      .flush([]);
    http
      .expectOne('/api/budget/budget-test/cotisations/cotisation-test/payments')
      .flush([
        {
          id: 'payment-test',
          amount: 24.01,
          comment: 'Virement de test',
          date: '2026-10-19T12:00:00Z',
          user: { username: 'operator@example.invalid' },
        },
      ]);
    TestBed.tick();
    const dialog = document.querySelector('mat-dialog-container');
    expect(dialog?.textContent).toContain('Paiements');
    expect(dialog?.textContent).toContain('Virement de test');
    expect(dialog?.textContent).toContain('2026-10-19');
    expect(dialog?.textContent).toContain('24,01');
  });
  it('adapts the same window to mobile and desktop without closing or reloading it', () => {
    const ref = TestBed.inject(NotificationsService).showForm(
      PaymentListComponent,
      {
        ...COTISATION_DIALOG_OPTIONS,
        data: { budgetId: 'sizing', cotisationId: 'call', unitNumber: 24 },
      }
    );
    TestBed.tick();
    http
      .expectOne('/api/budget/sizing')
      .flush({}, { status: 503, statusText: 'Unavailable' });
    TestBed.tick();
    const pane = document.querySelector<HTMLElement>('.cotisation-dialog')!;
    expect(pane.style.maxWidth).toBe('100vw');
    const desktopWidth = pane.style.width;
    expect(desktopWidth).toContain('76rem');
    expect(pane.textContent).toContain('Cotisation du lot 24');
    handset.next({ matches: true, breakpoints: {} });
    expect(pane.style.width).toBe('100vw');
    expect(pane.style.height).toBe('100dvh');
    handset.next({ matches: false, breakpoints: {} });
    expect(pane.style.width).toBe(desktopWidth);
    expect(TestBed.inject(MatDialog).openDialogs).toEqual([ref]);
    http.expectNone('/api/budget/sizing');
  });
  it('keeps drafts and loaded data across tabs, exposes payment creation, and blocks navigation during a financial write', () => {
    const ref = TestBed.inject(NotificationsService).showForm(
      PaymentListComponent,
      {
        ...COTISATION_DIALOG_OPTIONS,
        data: { budgetId: 'tabs', cotisationId: 'call' },
      }
    );
    TestBed.tick();
    http
      .expectOne('/api/budget/tabs')
      .flush({ id: 'tabs', label: 'Budget des onglets', draft: false });
    TestBed.tick();
    http.expectOne('/api/budget/tabs/cotisations').flush([
      {
        id: 'call',
        unit: { number: 12 },
        amount: 100,
        paid: 150,
        remaining: -50,
      },
    ]);
    http.expectOne('/api/budget/tabs/cotisations/call/entries').flush([]);
    http.expectOne('/api/budget/tabs/cotisations/call/payments').flush([]);
    TestBed.tick();
    const page = ref.componentInstance;
    const history = page.history!;
    const dialog = document.querySelector('mat-dialog-container')!;
    history.start('refund');
    history.form.patchValue({ amount: 25, reason: 'Motif conservé' });
    TestBed.tick();
    const tabs = dialog.querySelectorAll<HTMLButtonElement>('nav button');
    tabs[1].click();
    TestBed.tick();
    expect(
      dialog.querySelector('app-financial-history')?.hasAttribute('hidden')
    ).toBe(true);
    const create = dialog.querySelector<HTMLButtonElement>(
      '[aria-label="Ajouter un paiement"]'
    )!;
    expect(create.disabled).toBe(false);
    const open = vi
      .spyOn(TestBed.inject(NotificationsService), 'showForm')
      .mockReturnValue({ afterClosed: () => of(false) } as any);
    create.click();
    expect(open).toHaveBeenCalledWith(
      PaymentFormComponent,
      expect.objectContaining({
        data: expect.objectContaining({ cotisation: { id: 'call' } }),
      })
    );
    open.mockRestore();
    tabs[0].click();
    TestBed.tick();
    expect(page.history).toBe(history);
    expect(history.form.controls.reason.value).toBe('Motif conservé');
    history.busy = true;
    TestBed.tick();
    expect(tabs[1].getAttribute('aria-disabled')).toBe('true');
    tabs[1].click();
    expect(page.view).toBe('situation');
    expect(
      dialog.querySelector<HTMLButtonElement>('[mat-dialog-actions] button')
        ?.disabled
    ).toBe(true);
    page.setView('payments');
    expect(page.view).toBe('situation');
    history.busy = false;
    TestBed.tick();
    http.expectNone('/api/budget/tabs');
    http.expectNone('/api/budget/tabs/cotisations/call/payments');
  });
});
