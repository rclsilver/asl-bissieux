import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { NotificationDialogLevel } from 'src/app/shared/components/notification-dialog/notification-dialog.component';
import { NotificationsService } from 'src/app/shared/services/notifications.service';

@Component({
  selector: 'app-budget-email-form',
  templateUrl: './budget-email-form.component.html',
  styleUrls: ['./budget-email-form.component.scss'],
})
export class BudgetEmailFormComponent {
  private readonly _notifications = inject(NotificationsService);
  private readonly _builder = inject(FormBuilder);
  private readonly _api = inject(ApiService);

  readonly form: FormGroup;

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
    });
  }

  cancel() {
    this._dialogRef.close(false);
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
