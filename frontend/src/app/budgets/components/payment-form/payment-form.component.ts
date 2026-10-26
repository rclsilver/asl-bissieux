import {
  Component,
  Inject,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import moment from 'moment';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { NotificationDialogLevel } from 'src/app/shared/components/notification-dialog/notification-dialog.component';
import { NotificationsService } from 'src/app/shared/services/notifications.service';
import { validMoneyInput } from '../../money-input';

@Component({
  selector: 'app-payment-form',
  templateUrl: './payment-form.component.html',
  styleUrls: ['./payment-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class PaymentFormComponent {
  private readonly _notifications = inject(NotificationsService);
  private readonly _builder = inject(FormBuilder);
  private readonly _api = inject(ApiService);

  readonly form: FormGroup;
  busy = false;

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
      amount: [
        this.data.payment?.amount,
        [
          Validators.required,
          (control: { value: unknown }) =>
            validMoneyInput(control.value) ? null : { money: true },
        ],
      ],
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
    if (!this.busy) this._dialogRef.close(false);
  }

  submit() {
    if (this.busy) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
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

    this.busy = true;
    this.form.disable();
    result$.subscribe({
      next: (payment) => {
        this._dialogRef.close(true);
        this._notifications.showDialog({
          title: 'Paiement enregistré',
          message: this.data.payment?.id
            ? 'Le paiement a été modifié.'
            : 'Le paiement a été enregistré.',
          level: NotificationDialogLevel.Info,
        });
      },
      error: (error) => {
        this.busy = false;
        this.form.enable();
        this._api.handleError('Impossible d’enregistrer le paiement')(error);
      },
    });
  }
}
