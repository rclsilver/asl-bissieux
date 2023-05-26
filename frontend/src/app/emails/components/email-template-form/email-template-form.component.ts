import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { NotificationDialogLevel } from 'src/app/shared/components/notification-dialog/notification-dialog.component';
import { NotificationsService } from 'src/app/shared/services/notifications.service';

@Component({
  selector: 'app-email-template-form',
  templateUrl: './email-template-form.component.html',
  styleUrls: ['./email-template-form.component.scss'],
})
export class EmailTemplateFormComponent {
  private readonly _notifications = inject(NotificationsService);
  private readonly _builder = inject(FormBuilder);
  private readonly _api = inject(ApiService);

  readonly form: FormGroup;

  constructor(
    @Inject(MAT_DIALOG_DATA)
    public readonly data: {
      template?: APISchemas['ModelsEmailTemplate'];
    },
    private readonly _dialogRef: MatDialogRef<EmailTemplateFormComponent>
  ) {
    this.form = this._builder.group({
      label: [this.data.template?.label, [Validators.required]],
      subject: [this.data.template?.subject, [Validators.required]],
      message: [this.data.template?.message, [Validators.required]],
    });

    if (this.data.template) {
      this.form.markAllAsTouched();
    }
  }

  cancel() {
    this._dialogRef.close(false);
  }

  submit() {
    const payload: Partial<APISchemas['ModelsEmailTemplate']> = {
      label: this.form.value.label,
      subject: this.form.value.subject,
      message: this.form.value.message,
    };

    const result$ = !this.data.template?.id
      ? this._api.createEmailTemplate(payload)
      : this._api.updateEmailTemplate(this.data.template.id, payload);

    result$.subscribe({
      next: (result) => {
        this._dialogRef.close(true);
        this._notifications.showDialog({
          title: 'Success',
          message: this.data.template?.id
            ? `Template ${result?.label} has been updated`
            : `Template ${result?.label} has been created`,
          level: NotificationDialogLevel.Info,
        });
      },
      error: (error) => {
        this._notifications.showDialog({
          title: 'Error',
          message: this.data.template?.id
            ? `Unable to update template: ${error}`
            : `Unable to create template: ${error}`,
          level: NotificationDialogLevel.Error,
        });
      },
    });
  }
}
