import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { NotificationDialogLevel } from 'src/app/shared/components/notification-dialog/notification-dialog.component';
import { NotificationsService } from 'src/app/shared/services/notifications.service';

@Component({
  selector: 'app-email-attachment-form',
  templateUrl: './email-attachment-form.component.html',
  styleUrls: ['./email-attachment-form.component.scss'],
})
export class EmailAttachmentFormComponent {
  private readonly _notifications = inject(NotificationsService);
  private readonly _builder = inject(FormBuilder);
  private readonly _api = inject(ApiService);

  file?: File;

  readonly form: FormGroup;

  constructor(
    @Inject(MAT_DIALOG_DATA)
    public readonly data: {
      template: APISchemas['ModelsEmailTemplate'];
    },
    private readonly _dialogRef: MatDialogRef<EmailAttachmentFormComponent>
  ) {
    this.form = this._builder.group({
      name: ['', [Validators.required]],
      inline: [false],
    });
  }

  onFileSelected(file?: File) {
    if (file) {
      this.form.setValue({
        name: file.name,
        inline: false,
      });
    }
    this.file = file;
  }

  cancel() {
    this._dialogRef.close(false);
  }

  submit() {
    this._api
      .createEmailAttachment(
        this.data.template.id!,
        this.form.value.name,
        this.form.value.inline,
        this.file!
      )
      .subscribe({
        next: (result) => {
          this._dialogRef.close(true);
          this._notifications.showDialog({
            title: 'Success',
            message: `Attachment ${result?.name} has been created`,
            level: NotificationDialogLevel.Info,
          });
        },
        error: this._api.handleError('Unable to create attachment'),
      });
  }
}
