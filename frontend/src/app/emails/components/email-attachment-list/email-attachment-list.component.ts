import {
  Component,
  Inject,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { Column } from 'src/app/shared/models/column.model';
import { NotificationsService } from 'src/app/shared/services/notifications.service';
import { EmailAttachmentDataSource } from '../../datasources/attachment.datasource';
import { EmailAttachmentFormComponent } from '../email-attachment-form/email-attachment-form.component';
import { NotificationDialogLevel } from 'src/app/shared/components/notification-dialog/notification-dialog.component';
import { CustomRowAction } from 'src/app/shared/components/crud-table/crud-table.component';

@Component({
  selector: 'app-email-attachment-list',
  templateUrl: './email-attachment-list.component.html',
  styleUrls: ['./email-attachment-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class EmailAttachmentListComponent {
  private readonly _api = inject(ApiService);
  private readonly _auth = inject(AuthService);
  private readonly _notifications = inject(NotificationsService);

  constructor(
    @Inject(MAT_DIALOG_DATA)
    public readonly data: {
      template: APISchemas['ModelsEmailTemplate'];
    },
    private readonly _dialogRef: MatDialogRef<EmailAttachmentListComponent>
  ) {}

  readonly rowActions = [
    new CustomRowAction<APISchemas['ModelsAttachment']>(
      'download',
      'Télécharger la pièce jointe',
      'Télécharger',
      (row) => this.download(row)
    ),
  ];

  readonly columns = [
    new Column('name', {
      label: 'Nom',
      canSort: true,
      canFilter: true,
    }),
    new Column('inline', {
      label: 'Intégrée au message',
      canSort: true,
    }),
    new Column('size', {
      label: 'Taille',
      canSort: true,
    }),
    new Column('content_type', {
      label: 'Type de fichier',
      canSort: true,
      canFilter: true,
    }),
  ];
  readonly datasource = new EmailAttachmentDataSource(this.data.template.id!);

  readonly canCreate$ = this._auth.allowed$('email.AddAttachment');

  refresh() {
    this.datasource.load();
  }

  canDelete(_: APISchemas['ModelsAttachment']) {
    return this._auth.allowed$('email.RemoveAttachment');
  }

  edit(_?: APISchemas['ModelsAttachment']) {
    this._notifications
      .showForm(EmailAttachmentFormComponent, {
        data: {
          template: this.data.template,
        },
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.refresh();
        }
      });
  }

  download(attachment: APISchemas['ModelsAttachment']) {
    this._api
      .getEmailAttachment(this.data.template.id!, attachment.id!)
      .subscribe((data) => {
        const blob = new Blob([data], { type: attachment.content_type });
        const url = window.URL.createObjectURL(blob);
        const pwa = window.open(url);

        if (!pwa || pwa.closed || typeof pwa.closed == 'undefined') {
          alert(
            'Autorise les fenêtres surgissantes pour cette application, puis réessaie.'
          );
        }
      });
  }

  delete(attachment: APISchemas['ModelsAttachment']) {
    this._notifications
      .showConfirm({
        title: 'Supprimer une pièce jointe',
        confirmLabel: 'Supprimer',
        message: `Supprimer la pièce jointe « ${attachment.name} » ?`,
        class: 'warn',
      })
      .afterClosed()
      .subscribe((confirm) => {
        if (confirm) {
          this._api
            .deleteEmailAttachment(this.data.template.id!, attachment.id!)
            .subscribe({
              next: () => {
                this.refresh();
                this._notifications.showDialog({
                  title: 'Info',
                  message: `La pièce jointe « ${attachment.name} » a été supprimée.`,
                  level: NotificationDialogLevel.Info,
                });
              },
              error: this._api.handleError(
                'Impossible de supprimer la pièce jointe'
              ),
            });
        }
      });
  }

  close() {
    this._dialogRef.close(false);
  }
}
