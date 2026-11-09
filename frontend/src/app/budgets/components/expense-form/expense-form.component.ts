import {
  Component,
  Inject,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { NotificationDialogLevel } from 'src/app/shared/components/notification-dialog/notification-dialog.component';
import { NotificationsService } from 'src/app/shared/services/notifications.service';
import { validMoneyInput } from '../../money-input';

@Component({
  selector: 'app-expense-form',
  templateUrl: './expense-form.component.html',
  styleUrls: ['./expense-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class ExpenseFormComponent {
  private readonly _notifications = inject(NotificationsService);
  private readonly _builder = inject(FormBuilder);
  private readonly _api = inject(ApiService);

  saving = false;
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
      amount: [
        this.data.expense?.amount,
        [
          Validators.required,
          (control: { value: unknown }) =>
            validMoneyInput(control.value) ? null : { money: true },
        ],
      ],
    });

    if (this.data.expense) {
      this.form.markAllAsTouched();
    }
  }

  cancel() {
    if (this.saving) return;
    this._dialogRef.close(false);
  }

  submit() {
    if (this.saving) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
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

    this.saving = true;
    result$.pipe(finalize(() => (this.saving = false))).subscribe({
      next: (expense) => {
        this._dialogRef.close(true);
        this._notifications.showDialog({
          title: 'Enregistrement terminé',
          message: this.data.expense?.id
            ? `Dépense ${expense?.label} a été modifié(e)`
            : `Dépense ${expense?.label} a été créé(e)`,
          level: NotificationDialogLevel.Info,
        });
      },
      error: this._api.handleError(
        this.data.expense?.id
          ? 'Impossible de modifier la dépense'
          : 'Impossible de créer la dépense'
      ),
    });
  }
}
