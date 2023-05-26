import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { NotificationDialogLevel } from 'src/app/shared/components/notification-dialog/notification-dialog.component';
import { NotificationsService } from 'src/app/shared/services/notifications.service';

@Component({
  selector: 'app-budget-form',
  templateUrl: './budget-form.component.html',
  styleUrls: ['./budget-form.component.scss'],
})
export class BudgetFormComponent {
  private readonly _notifications = inject(NotificationsService);
  private readonly _builder = inject(FormBuilder);
  private readonly _api = inject(ApiService);

  readonly form: FormGroup;

  constructor(
    @Inject(MAT_DIALOG_DATA)
    public readonly data: {
      budget?: APISchemas['ModelsBudget'];
    },
    private readonly _dialogRef: MatDialogRef<BudgetFormComponent>
  ) {
    this.form = this._builder.group({
      label: [this.data.budget?.label, [Validators.required]],
    });

    if (this.data.budget) {
      this.form.markAllAsTouched();
    }
  }

  cancel() {
    this._dialogRef.close(false);
  }

  submit() {
    const payload: Partial<APISchemas['ModelsBudget']> = {
      label: this.form.value.label,
    };

    const result$ = !this.data.budget?.id
      ? this._api.createBudget(payload)
      : this._api.updateBudget(this.data.budget.id, payload);

    result$.subscribe({
      next: (budget) => {
        this._dialogRef.close(true);
        this._notifications.showDialog({
          title: 'Success',
          message: this.data.budget?.id
            ? `Budget ${budget?.label} has been updated`
            : `Budget ${budget?.label} has been created`,
          level: NotificationDialogLevel.Info,
        });
      },
      error: this._api.handleError(
        this.data.budget?.id
          ? 'Unable to update budget'
          : 'Unable to create budget'
      ),
    });
  }
}
