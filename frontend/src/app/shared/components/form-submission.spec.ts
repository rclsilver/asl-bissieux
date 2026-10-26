import { provideZoneChangeDetection } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { EmailsModule } from '../../emails/emails.module';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiService } from '../../core/services/api.service';
import { NotificationsService } from '../services/notifications.service';
import { BudgetFormComponent } from '../../budgets/components/budget-form/budget-form.component';
import { ExpenseFormComponent } from '../../budgets/components/expense-form/expense-form.component';
import { UnitFormComponent } from '../../units/components/unit-form/unit-form.component';
import { EmailAttachmentFormComponent } from '../../emails/components/email-attachment-form/email-attachment-form.component';
import { MemberFormComponent } from '../../members/components/member-form/member-form.component';

describe('Protected form submissions and partial member recovery', () => {
  let api: any;
  let dialog: any;
  let notifications: any;
  beforeEach(() => {
    api = { handleError: vi.fn(() => vi.fn()), listUnits: () => of([]) };
    dialog = { close: vi.fn() };
    notifications = {
      showDialog: vi.fn(() => ({ afterClosed: () => of(true) })),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: api },
        { provide: NotificationsService, useValue: notifications },
      ],
    });
  });
  for (const kind of ['budget', 'expense', 'unit', 'attachment'])
    it(
      'keeps ' +
        kind +
        ' input and allows retry after an error without concurrent creation',
      () => {
        const pending = new Subject<any>();
        const create = vi.fn<
          (...args: any[]) => import('rxjs').Observable<any>
        >(() => pending);
        Object.assign(api, {
          createBudget: create,
          createExpense: create,
          createUnit: create,
          createEmailAttachment: create,
        });
        const form = TestBed.runInInjectionContext(() =>
          kind === 'budget'
            ? new BudgetFormComponent({}, dialog)
            : kind === 'expense'
              ? new ExpenseFormComponent({ budgetId: 'b' }, dialog)
              : kind === 'unit'
                ? new UnitFormComponent({}, dialog)
                : new EmailAttachmentFormComponent(
                    { template: { id: 't' } },
                    dialog
                  )
        );
        if (kind === 'budget')
          form.form.patchValue({ label: 'Saisie conservée' });
        if (kind === 'expense')
          form.form.patchValue({ label: 'Saisie conservée', amount: 20 });
        if (kind === 'unit')
          form.form.patchValue({
            number: 1,
            share: 10,
            address: 'Saisie conservée',
          });
        if (form instanceof EmailAttachmentFormComponent)
          form.onFileSelected(new File(['fixture'], 'fixture.txt'));
        const input = form.form.value;
        form.submit();
        form.submit();
        form.cancel();
        expect(create).toHaveBeenCalledTimes(1);
        expect(dialog.close).not.toHaveBeenCalled();
        expect(form.saving).toBe(true);
        pending.error(new Error('Fixture failure'));
        expect(form.saving).toBe(false);
        expect(form.form.value).toEqual(input);
        create.mockReturnValue(of({ id: 'saved' }));
        form.submit();
        expect(create).toHaveBeenCalledTimes(2);
        expect(dialog.close).toHaveBeenCalledWith(true);
      }
    );
  it('enables attachment saving immediately after choosing a file without editing its generated name', async () => {
    await TestBed.configureTestingModule({
      imports: [EmailsModule, NoopAnimationsModule],
      providers: [
        provideZoneChangeDetection(),
        { provide: MAT_DIALOG_DATA, useValue: { template: { id: 't' } } },
        { provide: MatDialogRef, useValue: dialog },
      ],
    }).compileComponents();
    const f = TestBed.createComponent(EmailAttachmentFormComponent);
    f.detectChanges();
    const input = f.nativeElement.querySelector('input[type="file"]');
    Object.defineProperty(input, 'files', {
      value: [new File(['fixture'], 'fixture.txt')],
    });
    input.dispatchEvent(new Event('change'));
    f.detectChanges();
    expect(
      f.nativeElement.querySelector('button[type="submit"]').disabled
    ).toBe(false);
    expect(f.componentInstance.form.value.name).toBe('fixture.txt');
  });
  it('signals partial member writes when closing after a failed association check', () => {
    Object.assign(api, {
      createMember: vi.fn(() => of({ id: 'created' })),
      getMember: vi.fn(() =>
        throwError(() => new Error('Fixture lookup failure'))
      ),
    });
    const form = TestBed.runInInjectionContext(
      () => new MemberFormComponent({}, dialog)
    );
    form.form.patchValue({
      first_name: 'Alice',
      last_name: 'Fixture',
      email: 'alice@example.invalid',
    });
    form.submit();
    form.cancel();
    expect(dialog.close).toHaveBeenCalledWith(true);
    expect(api.handleError).toHaveBeenCalledWith(
      expect.stringContaining('Le membre est enregistré')
    );
  });
  it('retains a created member identity after an association failure and locks the entire chain', () => {
    const created = new Subject<any>(),
      association = new Subject<any>();
    const member = {
      id: 'member',
      first_name: 'Alice',
      last_name: 'Fixture',
      units: [],
    };
    Object.assign(api, {
      createMember: vi.fn(() => created),
      updateMember: vi.fn(() => of(member)),
      getMember: vi.fn(() => of(member)),
      addMemberUnit: vi.fn(() => association),
    });
    const form = TestBed.runInInjectionContext(
      () => new MemberFormComponent({}, dialog)
    );
    form.form.patchValue({
      first_name: 'Alice',
      last_name: 'Fixture',
      email: 'alice@example.invalid',
    });
    form.selectedUnits = [{ id: 'lot' }];
    let saving = false;
    form.saving$.subscribe((v) => (saving = v));
    form.submit();
    created.next(member);
    created.complete();
    expect(saving).toBe(true);
    form.submit();
    expect(api.createMember).toHaveBeenCalledTimes(1);
    expect(api.updateMember).not.toHaveBeenCalled();
    association.error(new Error('Fixture association failure'));
    expect(saving).toBe(false);
    api.addMemberUnit.mockReturnValue(of(null));
    form.submit();
    expect(api.createMember).toHaveBeenCalledTimes(1);
    expect(api.updateMember).toHaveBeenCalledWith(
      'member',
      expect.objectContaining({ first_name: 'Alice' })
    );
    expect(dialog.close).toHaveBeenCalledWith(true);
  });
});
