import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { NotificationDialogLevel } from 'src/app/shared/components/notification-dialog/notification-dialog.component';
import { NotificationsService } from 'src/app/shared/services/notifications.service';

@Component({
  selector: 'app-expense-form',
  templateUrl: './expense-form.component.html',
  styleUrls: ['./expense-form.component.scss'],
})
export class ExpenseFormComponent {
  private readonly _notifications = inject(NotificationsService);
  private readonly _builder = inject(FormBuilder);
  private readonly _api = inject(ApiService);

  readonly form: FormGroup;

  constructor(
    @Inject(MAT_DIALOG_DATA)
    public readonly data: {
      budgetId: string;
      expense?: APISchemas['ModelsExpense'];
    },
    private readonly _dialogRef: MatDialogRef<ExpenseFormComponent>
  ) {
    this.form = this._builder.group({
      label: [this.data.expense?.label, [Validators.required]],
      amount: [this.data.expense?.amount, [Validators.required]],
    });

    if (this.data.expense) {
      this.form.markAllAsTouched();
    }
  }

  cancel() {
    this._dialogRef.close(false);
  }

  submit() {
    const payload: Partial<APISchemas['ModelsExpense']> = {
      label: this.form.value.label,
      amount: this.form.value.amount,
    };

    const result$ = !this.data.expense?.id
      ? this._api.createExpense(this.data.budgetId, payload)
      : this._api.updateExpense(
          this.data.budgetId,
          this.data.expense.id,
          payload
        );

    result$.subscribe({
      next: (expense) => {
        this._dialogRef.close(true);
        this._notifications.showDialog({
          title: 'Success',
          message: this.data.expense?.id
            ? `Expense ${expense?.label} has been updated`
            : `Expense ${expense?.label} has been created`,
          level: NotificationDialogLevel.Info,
        });
      },
      error: this._api.handleError(
        this.data.expense?.id
          ? 'Unable to update expense'
          : 'Unable to create expense'
      ),
    });
  }
}
