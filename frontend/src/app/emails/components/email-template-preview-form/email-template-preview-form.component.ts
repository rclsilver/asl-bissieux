import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { NotificationDialogLevel } from 'src/app/shared/components/notification-dialog/notification-dialog.component';
import { NotificationsService } from 'src/app/shared/services/notifications.service';
import { EmailTemplatePreviewComponent } from '../email-template-preview/email-template-preview.component';

@Component({
  selector: 'app-email-template-preview-form',
  templateUrl: './email-template-preview-form.component.html',
  styleUrls: ['./email-template-preview-form.component.scss'],
})
export class EmailTemplatePreviewFormComponent {
  private readonly _notifications = inject(NotificationsService);
  private readonly _builder = inject(FormBuilder);
  private readonly _api = inject(ApiService);

  readonly form: FormGroup;

  constructor(
    @Inject(MAT_DIALOG_DATA)
    public readonly data: {
      template: APISchemas['ModelsEmailTemplate'];
    },
    private readonly _dialogRef: MatDialogRef<EmailTemplatePreviewFormComponent>
  ) {
    this.form = this._builder.group({
      data: ['{}', [Validators.required]],
    });
  }

  close() {
    this._dialogRef.close(false);
  }

  submit() {
    try {
      const data = JSON.parse(this.form.value.data);

      this._api
        .previewEmailTemplate(this.data.template.id!, { data })
        .subscribe({
          next: (result) =>
            this._notifications.show(EmailTemplatePreviewComponent, {
              data: {
                subject: result?.subject,
                message: result?.message,
              },
            }),
          error: this._api.handleError('Unable to generate preview'),
        });
    } catch (error) {
      this._notifications.showDialog({
        title: 'Error',
        message: `Unable to generate preview: ${error}`,
        level: NotificationDialogLevel.Error,
      });
    }
  }
}
