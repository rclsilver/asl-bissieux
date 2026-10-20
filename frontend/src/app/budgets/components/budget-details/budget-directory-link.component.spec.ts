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
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from 'src/app/core/services/auth.service';
import { NotificationsService } from 'src/app/shared/services/notifications.service';
import { BudgetsModule } from '../../budgets.module';
import { BudgetDetailsComponent } from './budget-details.component';

describe('Budget map directory link', () => {
  let http: HttpTestingController;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BudgetsModule, NoopAnimationsModule],
      providers: [
        provideZoneChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: 'budget-test' })) },
        },
        { provide: AuthService, useValue: { allowed$: () => of(false) } },
        {
          provide: NotificationsService,
          useValue: { showForm: vi.fn(), showDialog: vi.fn() },
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('opens the directory using the selected SVG lot number while preserving payment styling', async () => {
    const fixture = TestBed.createComponent(BudgetDetailsComponent);
    fixture.detectChanges();
    http.expectOne('/api/budget/budget-test').flush({
      id: 'budget-test',
      label: 'Budget test',
      draft: false,
      amount: 100,
      paid: 120,
    });
    fixture.detectChanges();
    for (const request of http.match((request) =>
      request.url.startsWith('/api/budget/budget-test/')
    )) {
      request.flush(
        request.request.url.endsWith('/cotisations')
          ? [
              {
                id: 'cotisation-test',
                amount: 100,
                paid: 120,
                remaining: -20,
                payment_state: 4,
                unit: { id: 'unit-test', number: 1, members: [] },
              },
            ]
          : []
      );
    }
    fixture.detectChanges();
    const tabs = Array.from(
      fixture.nativeElement.querySelectorAll('[role="tab"]')
    ) as HTMLElement[];
    tabs.find((tab) => tab.textContent?.includes('Carte'))!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    const unit = fixture.nativeElement.querySelector('#unit-01') as SVGGElement;
    expect(unit.classList.contains('payment-overpaid')).toBe(true);
    unit.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector(
      'a[href*="/members"]'
    ) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toContain('/members?view=map&lot=1');
    expect(link.textContent).toContain('lot 1');
    expect(
      unit.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(unit.classList.contains('payment-overpaid')).toBe(true);
    expect(unit.classList.contains('unit-selected')).toBe(true);
    http.expectNone('/api/member');
  });
});
