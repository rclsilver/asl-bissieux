import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import * as moment from 'moment';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { NotificationDialogLevel } from 'src/app/shared/components/notification-dialog/notification-dialog.component';
import { NotificationsService } from 'src/app/shared/services/notifications.service';

@Component({
  selector: 'app-payment-form',
  templateUrl: './payment-form.component.html',
  styleUrls: ['./payment-form.component.scss'],
})
export class PaymentFormComponent {
  private readonly _notifications = inject(NotificationsService);
  private readonly _builder = inject(FormBuilder);
  private readonly _api = inject(ApiService);

  readonly form: FormGroup;

  constructor(
    @Inject(MAT_DIALOG_DATA)
    public readonly data: {
      budget: APISchemas['ModelsBudget'];
      cotisation: APISchemas['ModelsCotisation'];
      payment?: APISchemas['ModelsPayment'];
    },
    private readonly _dialogRef: MatDialogRef<PaymentFormComponent>
  ) {
    this.form = this._builder.group({
      amount: [this.data.payment?.amount, [Validators.required]],
      comment: [this.data.payment?.comment, [Validators.required]],
      date: [
        moment(
          this.data.payment?.date
            ? new Date(this.data.payment?.date)
            : new Date()
        ).format('YYYY-MM-DD'),
        [Validators.required],
      ],
    });

    if (this.data.payment) {
      this.form.markAllAsTouched();
    }
  }

  cancel() {
    this._dialogRef.close(false);
  }

  submit() {
    const payload: Partial<APISchemas['ModelsPayment']> = {
      amount: this.form.value.amount,
      comment: this.form.value.comment,
      date: moment(new Date(this.form.value.date)).format(),
    };
    const result$ = !this.data.payment?.id
      ? this._api.createPayment(
          this.data.budget.id!,
          this.data.cotisation.id!,
          payload
        )
      : this._api.updatePayment(
          this.data.budget.id!,
          this.data.cotisation.id!,
          this.data.payment.id,
          payload
        );

    result$.subscribe({
      next: (payment) => {
        this._dialogRef.close(true);
        this._notifications.showDialog({
          title: 'Success',
          message: this.data.payment?.id
            ? 'Payment has been update'
            : 'Payment has been created',
          level: NotificationDialogLevel.Info,
        });
      },
      error: (error) => {
        /*
        if (error.fields) {
          error.fields.forEach((field) =>
            this.form.controls[field.name].setErrors({ server: field.message })
          );
        } else {
          */
        this._notifications.showDialog({
          title: 'Error',
          message: this.data.payment?.id
            ? `Unable to update payment: ${error}`
            : `Unable to create payment: ${error}`,
          level: NotificationDialogLevel.Error,
        });
        /*
        }
        */
      },
    });
  }
}
