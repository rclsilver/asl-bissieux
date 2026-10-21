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
  selector: 'app-email-attachment-form',
  templateUrl: './email-attachment-form.component.html',
  styleUrls: ['./email-attachment-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class EmailAttachmentFormComponent {
  private readonly _notifications = inject(NotificationsService);
  private readonly _builder = inject(FormBuilder);
  private readonly _api = inject(ApiService);

  file?: File;

  saving = false;
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
      this.form.markAsTouched();
      this.form.markAsDirty();
      this.form.setValue({
        name: file.name,
        inline: false,
      });
    }
    this.file = file;
  }

  cancel() {
    if (this.saving) return;
    this._dialogRef.close(false);
  }

  submit() {
    if (this.saving) return;
    if (this.form.invalid || !this.file) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving = true;
    this._api
      .createEmailAttachment(
        this.data.template.id!,
        this.form.value.name,
        this.form.value.inline,
        this.file!
      )
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (result) => {
          this._dialogRef.close(true);
          this._notifications.showDialog({
            title: 'Enregistrement terminé',
            message: `Pièce jointe ${result?.name} a été créé(e)`,
            level: NotificationDialogLevel.Info,
          });
        },
        error: this._api.handleError('Impossible d’ajouter la pièce jointe'),
      });
  }
}
