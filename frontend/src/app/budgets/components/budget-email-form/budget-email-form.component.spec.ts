import { provideZoneChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from 'src/app/core/services/auth.service';
import { NotificationsService } from 'src/app/shared/services/notifications.service';
import { BudgetsModule } from '../../budgets.module';
import { BudgetEmailFormComponent } from './budget-email-form.component';

const alice = {
  id: 'alice',
  first_name: 'Alice',
  last_name: 'Multi',
  email: 'shared@example.invalid',
};
const bob = {
  id: 'bob',
  first_name: 'Bob',
  last_name: 'Coowner',
  email: 'shared@example.invalid',
};
const camille = {
  id: 'camille',
  first_name: 'Camille',
  last_name: 'Paid',
  email: 'camille@example.invalid',
};
const dana = { id: 'dana', first_name: 'Dana', email: '' };
const cotisations = [
  {
    payment_state: 3,
    amount: 100,
    paid: 0,
    unit: { number: 1, members: [alice, bob] },
  },
  {
    payment_state: 3,
    amount: 100,
    paid: 25,
    unit: { number: 2, members: [alice] },
  },
  {
    payment_state: 2,
    amount: 100,
    paid: 50,
    unit: { number: 3, members: [camille] },
  },
  {
    payment_state: 1,
    amount: 100,
    paid: 100,
    unit: { number: 4, members: [camille, dana] },
  },
  {
    payment_state: 4,
    amount: 100,
    paid: 120,
    unit: { number: 5, members: [camille] },
  },
];
const templates = [
  {
    id: 'template-test',
    label: 'Appel de cotisation',
    subject: 'Bonjour {{.member.first_name}}',
    message: 'Budget {{.budget.label}}',
  },
];

describe('Budget email preparation', () => {
  let http: HttpTestingController;
  let close: ReturnType<typeof vi.fn>;
  let notify: ReturnType<typeof vi.fn>;
  let allowed: BehaviorSubject<boolean>;
  beforeEach(async () => {
    close = vi.fn();
    notify = vi.fn();
    allowed = new BehaviorSubject(true);
    await TestBed.configureTestingModule({
      imports: [BudgetsModule, NoopAnimationsModule],
      providers: [
        provideZoneChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            budget: { id: 'budget-test', label: 'Budget 2026', draft: false },
          },
        },
        { provide: MatDialogRef, useValue: { close } },
        { provide: NotificationsService, useValue: { showDialog: notify } },
        {
          provide: AuthService,
          useValue: { allowed$: () => allowed.asObservable() },
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  function setup() {
    const fixture = TestBed.createComponent(BudgetEmailFormComponent);
    fixture.detectChanges();
    http.expectOne('/api/email/templates').flush(templates);
    http.expectOne('/api/budget/budget-test/cotisations').flush(cotisations);
    fixture.detectChanges();
    fixture.componentInstance.form.controls.template.setValue('template-test');
    fixture.detectChanges();
    return fixture;
  }

  it('groups by member ID, preserves coowners and shows the exact eligible lot sets', () => {
    const fixture = setup();
    const page = fixture.componentInstance;
    expect(page.recipients.map((recipient) => recipient.member.id)).toEqual([
      'alice',
      'bob',
    ]);
    expect(page.recipients[0].lots).toEqual([1, 2]);
    expect(page.missingEmailCount).toBe(0);
    expect(page.canPrepare).toBe(false);
    page.submit();
    http.expectNone('/api/budget/budget-test/email');
    page.form.controls.to_doing.setValue(true);
    expect(page.recipients.map((recipient) => recipient.member.id)).toEqual([
      'alice',
      'bob',
      'camille',
    ]);
    page.form.controls.to_paid.setValue(true);
    expect(
      page.recipients.find((recipient) => recipient.member.id === 'camille')
        ?.lots
    ).toEqual([3, 4, 5]);
    expect(page.missingEmailCount).toBe(1);
    page.form.controls.previewMember.setValue('camille');
    page.form.controls.to_doing.setValue(false);
    page.form.controls.to_paid.setValue(false);
    expect(page.form.controls.previewMember.value).toBe('alice');
  });

  it('previews the current typed values and filters, then prepares once without sending individual messages', () => {
    const fixture = setup();
    const page = fixture.componentInstance;
    const data = { sender: { name: 'ASL' }, amount: 24.01, copy: false };
    page.form.controls.data.setValue(JSON.stringify(data));
    page.form.controls.to_doing.setValue(true);
    page.form.controls.previewMember.setValue('camille');
    page.preview();
    page.preview();
    const preview = http.expectOne('/api/budget/budget-test/email-preview');
    expect(preview.request.body).toEqual({
      template_id: 'template-test',
      member_id: 'camille',
      data,
      send_to_doing: true,
      send_to_paid: false,
    });
    expect(page.canPrepare).toBe(false);
    preview.flush({ subject: 'Bonjour Camille', message: '<p>Lot 3</p>' });
    fixture.detectChanges();
    expect(page.canPrepare).toBe(true);
    expect(
      fixture.nativeElement.querySelector('.preview-message').textContent
    ).toContain('Lot 3');
    page.submit();
    page.submit();
    expect(page.form.disabled).toBe(true);
    const prepare = http.expectOne('/api/budget/budget-test/email');
    expect(prepare.request.body).toEqual({
      template_id: 'template-test',
      data,
      send_to_doing: true,
      send_to_paid: false,
    });
    prepare.flush(null, { status: 202, statusText: 'Accepted' });
    expect(close).toHaveBeenCalledWith(true);
    expect(notify.mock.calls[0][0].message).toContain('Campagnes');
  });

  it('rejects stale preview responses and invalidates an existing preview after a change', () => {
    const page = setup().componentInstance;
    page.preview();
    const first = http.expectOne('/api/budget/budget-test/email-preview');
    page.form.controls.to_paid.setValue(true);
    first.flush({ subject: 'Old preview', message: '<p>old</p>' });
    expect(page.previewResult).toBeUndefined();
    expect(page.canPrepare).toBe(false);
    expect(page.error).toContain('changé');
    page.preview();
    http
      .expectOne('/api/budget/budget-test/email-preview')
      .flush({ subject: 'Current', message: '<p>current</p>' });
    expect(page.canPrepare).toBe(true);
    page.form.controls.data.setValue('{"reference":"nouvelle"}');
    expect(page.canPrepare).toBe(false);
    page.submit();
    http.expectNone('/api/budget/budget-test/email');
  });

  it('retains values through render and preparation errors and restores editing', () => {
    const page = setup().componentInstance;
    page.form.controls.data.setValue('{"date_limite":"31 décembre"}');
    page.preview();
    http
      .expectOne('/api/budget/budget-test/email-preview')
      .flush(
        { message: 'unable to execute: map has no entry for key "reference"' },
        { status: 400, statusText: 'Bad Request' }
      );
    expect(page.error).toContain('reference');
    expect(page.canPrepare).toBe(false);
    expect(page.form.controls.data.value).toContain('31 décembre');
    page.preview();
    http
      .expectOne('/api/budget/budget-test/email-preview')
      .flush({ subject: 'ok', message: '<p>ok</p>' });
    page.submit();
    http
      .expectOne('/api/budget/budget-test/email')
      .flush({}, { status: 503, statusText: 'Unavailable' });
    expect(page.creating).toBe(false);
    expect(page.form.enabled).toBe(true);
    expect(page.form.controls.data.value).toContain('31 décembre');
    expect(close).not.toHaveBeenCalled();
  });

  it('recovers resource loading and preserves typed values when retrying', () => {
    const fixture = TestBed.createComponent(BudgetEmailFormComponent);
    fixture.detectChanges();
    fixture.componentInstance.form.controls.data.setValue(
      '{"reference":"à conserver"}'
    );
    http.expectOne('/api/budget/budget-test/cotisations').flush(cotisations);
    http
      .expectOne('/api/email/templates')
      .flush({}, { status: 503, statusText: 'Unavailable' });
    expect(fixture.componentInstance.ready).toBe(false);
    expect(fixture.componentInstance.loadError).toContain('Réessaie');
    fixture.componentInstance.load();
    http.expectOne('/api/budget/budget-test/cotisations').flush(cotisations);
    http.expectOne('/api/email/templates').flush(templates);
    fixture.detectChanges();
    expect(fixture.componentInstance.ready).toBe(true);
    expect(fixture.componentInstance.form.controls.data.value).toContain(
      'à conserver'
    );
  });

  it('blocks invalid personalization and creation without permission', () => {
    const fixture = setup();
    const page = fixture.componentInstance;
    page.form.controls.data.setValue('{');
    fixture.detectChanges();
    expect(page.form.invalid).toBe(true);
    page.preview();
    http.expectNone('/api/budget/budget-test/email-preview');
    page.form.controls.data.setValue('{}');
    page.preview();
    http
      .expectOne('/api/budget/budget-test/email-preview')
      .flush({ subject: 'ok', message: '<p>ok</p>' });
    allowed.next(false);
    expect(page.canPrepare).toBe(false);
    page.submit();
    http.expectNone('/api/budget/budget-test/email');
  });
});
