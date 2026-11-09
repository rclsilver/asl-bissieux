import { CommonModule } from '@angular/common';
import { provideZoneChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Subject, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiService } from 'src/app/core/services/api.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { FinancialHistoryComponent } from './financial-history.component';

describe('Traced financial operations', () => {
  const preview$ = new Subject<any>();
  const save$ = new Subject<any>();
  const api = {
    listCotisations: vi.fn(() =>
      of([
        {
          id: 'call',
          unit: { number: 12, members: [] },
          amount: 100,
          paid: 150,
          remaining: -50,
        },
      ])
    ),
    listFinancialEntries: vi.fn(() => of([])),
    previewFinancialEntry: vi.fn(() => preview$),
    createFinancialEntry: vi.fn(() => save$),
  };
  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      declarations: [FinancialHistoryComponent],
      imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatMenuModule,
        MatIconModule,
        MatTooltipModule,
        NoopAnimationsModule,
      ],
      providers: [
        provideZoneChangeDetection(),
        { provide: ApiService, useValue: api },
        { provide: AuthService, useValue: { allowed$: () => of(true) } },
      ],
    }).compileComponents();
  });
  it('requires an effect preview, invalidates it after edits, freezes inputs and sends one confirmation', () => {
    const fixture = TestBed.createComponent(FinancialHistoryComponent);
    const c = fixture.componentInstance;
    c.budgetId = 'budget';
    c.cotisationId = 'call';
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('À rembourser');
    c.start('refund');
    c.form.patchValue({ amount: 25, reason: 'Retour de trop-perçu' });
    c.confirm();
    expect(api.createFinancialEntry).not.toHaveBeenCalled();
    c.review();
    c.review();
    expect(api.previewFinancialEntry).toHaveBeenCalledTimes(1);
    expect(c.form.disabled).toBe(true);
    preview$.next({
      version: 'v1',
      called_before: 100,
      called_after: 100,
      paid_before: 150,
      paid_after: 125,
      remaining_after: -25,
    });
    expect(c.preview?.version).toBe('v1');
    c.form.controls.amount.setValue(20);
    expect(c.preview).toBeNull();
    c.confirm();
    expect(api.createFinancialEntry).not.toHaveBeenCalled();
    c.review();
    preview$.next({ version: 'v2' });
    c.confirm();
    c.confirm();
    expect(api.createFinancialEntry).toHaveBeenCalledTimes(1);
    expect(api.createFinancialEntry).toHaveBeenCalledWith(
      'budget',
      'call',
      expect.objectContaining({
        amount: 20,
        version: 'v2',
        kind: 'refund',
        reason: 'Retour de trop-perçu',
      })
    );
    save$.error({ data: { message: 'La situation a changé' } });
    expect(c.busy).toBe(false);
    expect(c.preview).toBeNull();
    expect(c.form.getRawValue().amount).toBe(20);
    expect(c.error).toContain('changé');
    fixture.destroy();
  });
  it('keeps the original operation visible and requests a linked reversal', () => {
    const fixture = TestBed.createComponent(FinancialHistoryComponent);
    const c = fixture.componentInstance;
    c.budgetId = 'budget';
    c.cotisationId = 'call';
    fixture.detectChanges();
    c.start('adjustment', {
      id: 'original-entry',
      kind: 'adjustment',
      amount: -25,
      reason: 'Réduction initiale',
    });
    c.form.controls.reason.setValue('Erreur à corriger');
    c.review();
    expect(api.previewFinancialEntry).toHaveBeenCalledWith(
      'budget',
      'call',
      expect.objectContaining({
        reverses_id: 'original-entry',
        kind: 'adjustment',
        reason: 'Erreur à corriger',
      })
    );
    fixture.destroy();
  });
});
