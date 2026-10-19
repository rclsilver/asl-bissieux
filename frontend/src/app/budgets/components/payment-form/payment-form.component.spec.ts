import { CommonModule } from '@angular/common';
import { provideZoneChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiService } from 'src/app/core/services/api.service';
import { NotificationsService } from 'src/app/shared/services/notifications.service';
import { PaymentFormComponent } from './payment-form.component';

describe('Payment form after the Angular migration', () => {
  let fixture: ComponentFixture<PaymentFormComponent>;
  const api = {
    createPayment: vi.fn(() => of({})),
    updatePayment: vi.fn(() => of({})),
    handleError: vi.fn(() => vi.fn()),
  };
  const dialog = { close: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      declarations: [PaymentFormComponent],
      imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
        NoopAnimationsModule,
      ],
      providers: [
        provideZoneChangeDetection(),
        { provide: ApiService, useValue: api },
        { provide: MatDialogRef, useValue: dialog },
        { provide: NotificationsService, useValue: { showDialog: vi.fn() } },
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            budget: { id: 'budget-test' },
            cotisation: { id: 'cotisation-test' },
            payment: {
              id: 'payment-test',
              amount: 24.01,
              comment: 'Virement',
              date: '2026-10-19T12:00:00Z',
            },
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PaymentFormComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('renders an existing payment with its date and amount', () => {
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('h1')?.textContent).toContain(
      'Update payment'
    );
    expect(
      element.querySelector<HTMLInputElement>('[formControlName="amount"]')
        ?.value
    ).toBe('24.01');
    expect(
      element.querySelector<HTMLInputElement>('[formControlName="date"]')?.value
    ).toBe('2026-10-19');
  });

  it('shows the cent validation error and prevents an invalid submission', async () => {
    fixture.componentInstance.form.controls['amount'].setValue(24.001);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain(
      'Montant positif, avec au plus deux décimales.'
    );
    expect(
      fixture.nativeElement.querySelector('button[type="submit"]').disabled
    ).toBe(true);
    fixture.componentInstance.submit();
    expect(api.updatePayment).not.toHaveBeenCalled();
  });

  it('updates the selected payment without creating a duplicate', () => {
    fixture.componentInstance.form.controls['amount'].setValue(25.02);
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(api.updatePayment).toHaveBeenCalledWith(
      'budget-test',
      'cotisation-test',
      'payment-test',
      expect.objectContaining({ amount: 25.02, comment: 'Virement' })
    );
    expect(api.createPayment).not.toHaveBeenCalled();
    expect(dialog.close).toHaveBeenCalledWith(true);
  });
});
