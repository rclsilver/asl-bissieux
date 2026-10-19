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
import { PaymentListComponent } from './payment-list.component';

describe('Manage payments dialog', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PaymentListComponent],
      imports: [
        CommonModule,
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

  it('opens and renders the payments returned for the selected cotisation', async () => {
    TestBed.inject(NotificationsService).showForm(PaymentListComponent, {
      data: { budgetId: 'budget-test', cotisationId: 'cotisation-test' },
    });
    TestBed.tick();
    http
      .expectOne('/api/budget/budget-test')
      .flush({ id: 'budget-test', draft: false });
    TestBed.tick();
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
    expect(dialog?.textContent).toContain('Payments');
    expect(dialog?.textContent).toContain('Virement de test');
    expect(dialog?.textContent).toContain('2026-10-19');
    expect(dialog?.textContent).toContain('24,01');
  });
});
