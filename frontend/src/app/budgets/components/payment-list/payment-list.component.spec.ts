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
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
import { PaymentListComponent } from './payment-list.component';

describe('Manage payments dialog', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
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
        NoopAnimationsModule,
      ],
      providers: [
        provideZoneChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { allowed$: () => of(true) } },
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
});
