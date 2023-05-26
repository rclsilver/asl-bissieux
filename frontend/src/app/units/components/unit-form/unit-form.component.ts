import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { NotificationDialogLevel } from 'src/app/shared/components/notification-dialog/notification-dialog.component';
import { NotificationsService } from 'src/app/shared/services/notifications.service';

@Component({
  selector: 'app-unit-form',
  templateUrl: './unit-form.component.html',
  styleUrls: ['./unit-form.component.scss'],
})
export class UnitFormComponent {
  private readonly _notifications = inject(NotificationsService);
  private readonly _builder = inject(FormBuilder);
  private readonly _api = inject(ApiService);

  readonly form: FormGroup;

  constructor(
    @Inject(MAT_DIALOG_DATA)
    public readonly data: {
      unit?: APISchemas['ModelsUnit'];
    },
    private readonly _dialogRef: MatDialogRef<UnitFormComponent>
  ) {
    this.form = this._builder.group({
      number: [this.data.unit?.number, [Validators.required]],
      share: [this.data.unit?.share, [Validators.required]],
      address: [this.data.unit?.address, [Validators.required]],
    });

    if (this.data.unit) {
      this.form.markAllAsTouched();
    }
  }

  cancel() {
    this._dialogRef.close(false);
  }

  submit() {
    const payload: Partial<APISchemas['ModelsUnit']> = {
      number: this.form.value.number,
      share: this.form.value.share,
      address: this.form.value.address,
    };

    const result$ = !this.data.unit?.id
      ? this._api.createUnit(payload)
      : this._api.updateUnit(this.data.unit.id, payload);

    result$.subscribe({
      next: (unit) => {
        this._dialogRef.close(true);
        this._notifications.showDialog({
          title: 'Success',
          message: this.data.unit?.id
            ? `Unit ${unit?.number} has been updated`
            : `Unit ${unit?.number} has been created`,
          level: NotificationDialogLevel.Info,
        });
      },
      error: this._api.handleError(
        this.data.unit?.id ? 'Unable to update unit' : 'Unable to create unit'
      ),
    });
  }
}
