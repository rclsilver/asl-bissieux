import { Component, Inject, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogRef,
} from '@angular/material/dialog';
import {
  BehaviorSubject,
  Observable,
  Subject,
  combineLatest,
  map,
  shareReplay,
  startWith,
  takeUntil,
} from 'rxjs';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { EmailViewDialogComponent } from 'src/app/emails/components/email-view-dialog/email-view-dialog.component';
import { NotificationDialogLevel } from 'src/app/shared/components/notification-dialog/notification-dialog.component';
import { NotificationsService } from 'src/app/shared/services/notifications.service';

@Component({
  selector: 'app-budget-email-form',
  templateUrl: './budget-email-form.component.html',
  styleUrls: ['./budget-email-form.component.scss'],
})
export class BudgetEmailFormComponent implements OnInit, OnDestroy {
  private _destroyed$ = new Subject<void>();

  private readonly _dialog = inject(MatDialog);
  private readonly _notifications = inject(NotificationsService);
  private readonly _builder = inject(FormBuilder);
  private readonly _api = inject(ApiService);

  readonly form: FormGroup;

  private _members$ = new BehaviorSubject<APISchemas['ModelsMember'][]>([]);
  readonly members$: Observable<APISchemas['ModelsMember'][]>;

  constructor(
    @Inject(MAT_DIALOG_DATA)
    public readonly data: {
      budget: APISchemas['ModelsBudget'];
    },
    private readonly _dialogRef: MatDialogRef<BudgetEmailFormComponent>
  ) {
    this.form = this._builder.group({
      subject: ['', [Validators.required]],
      message: ['', [Validators.required]],
      to_paid: [false],
      to_doing: [false],
      previewMode: [true],
      previewMember: [null],
    });

    this.members$ = combineLatest([
      this._members$,
      this.form.valueChanges.pipe(
        map((value) => (value.previewMember ?? '') as string),
        startWith('')
      ),
    ]).pipe(
      map(([members, filter]) => {
        if (filter === '') {
          return members;
        }

        const f = filter.toLowerCase();

        return members.filter(
          (m) =>
            m.first_name?.toLowerCase().includes(f) ||
            m.last_name?.toLowerCase().includes(f) ||
            m.id?.toLowerCase().includes(f)
        );
      })
    );

    this.form.valueChanges
      .pipe(takeUntil(this._destroyed$))
      .subscribe((values) => {
        if (values.previewMode) {
          this.form.controls['previewMember'].addValidators(
            Validators.required
          );
        } else {
          this.form.controls['previewMember'].clearValidators();
        }
      });
  }

  ngOnInit() {
    this._api.listMembers().subscribe((result) => this._members$.next(result));
  }

  ngOnDestroy() {
    this._destroyed$.next();
    this._destroyed$.complete();
  }

  previewMemberDisplay(memberId?: string) {
    if (!memberId) {
      return '';
    }

    const member = this._members$.value.filter((m) => m.id === memberId);

    if (!member.length) {
      return '';
    }

    return `${member[0].first_name} ${member[0].last_name}`;
  }

  cancel() {
    this._dialogRef.close(false);
  }

  preview() {
    const payload: Partial<APISchemas['PreviewBudgetEmailInput']> = {
      subject: this.form.value.subject,
      message: this.form.value.message,
      member_id: this.form.value.previewMember,
    };

    this._api
      .previewBudgetEmail(this.data.budget.id!, payload)
      .subscribe((result) => {
        this._dialog.open(EmailViewDialogComponent, {
          width: '800px',
          data: {
            email: result,
          },
        });
      });
  }

  submit() {
    const payload: Partial<APISchemas['SendBudgetEmailInput']> = {
      subject: this.form.value.subject,
      message: this.form.value.message,
      send_to_doing: this.form.value.to_doing,
      send_to_paid: this.form.value.to_paid,
    };

    this._api.sendBudgetEmail(this.data.budget.id!, payload).subscribe({
      next: () => {
        this._dialogRef.close(true);
        this._notifications.showDialog({
          title: 'Success',
          message: `Emails created for budget ${this.data.budget.label}`,
          level: NotificationDialogLevel.Info,
        });
      },
      error: (error) => {
        this._notifications.showDialog({
          title: 'Error',
          message: `Unable to create emails: ${error}`,
          level: NotificationDialogLevel.Error,
        });
      },
    });
  }
}
