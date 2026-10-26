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

@Component({
  selector: 'app-budget-form',
  templateUrl: './budget-form.component.html',
  styleUrls: ['./budget-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class BudgetFormComponent {
  private readonly _notifications = inject(NotificationsService);
  private readonly _builder = inject(FormBuilder);
  private readonly _api = inject(ApiService);

  saving = false;
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
    if (this.saving) return;
    this._dialogRef.close(false);
  }

  submit() {
    if (this.saving) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const payload: Partial<APISchemas['ModelsBudget']> = {
      label: this.form.value.label,
    };

    const result$ = !this.data.budget?.id
      ? this._api.createBudget(payload)
      : this._api.updateBudget(this.data.budget.id, payload);

    this.saving = true;
    result$.pipe(finalize(() => (this.saving = false))).subscribe({
      next: (budget) => {
        this._dialogRef.close(true);
        this._notifications.showDialog({
          title: 'Enregistrement terminé',
          message: this.data.budget?.id
            ? `Budget ${budget?.label} a été modifié(e)`
            : `Budget ${budget?.label} a été créé(e)`,
          level: NotificationDialogLevel.Info,
        });
      },
      error: this._api.handleError(
        this.data.budget?.id
          ? 'Impossible de modifier le budget'
          : 'Impossible de créer le budget'
      ),
    });
  }
}
