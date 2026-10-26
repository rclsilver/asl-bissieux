import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { NotificationDialogLevel } from 'src/app/shared/components/notification-dialog/notification-dialog.component';
import { Column, CustomRenderColumn } from 'src/app/shared/models/column.model';
import { NotificationsService } from 'src/app/shared/services/notifications.service';
import { EmailTemplateDataSource } from '../../datasources/template.datasource';
import { EmailTemplateFormComponent } from '../email-template-form/email-template-form.component';
import { CustomRowAction } from 'src/app/shared/components/crud-table/crud-table.component';
import { EmailTemplatePreviewFormComponent } from '../email-template-preview-form/email-template-preview-form.component';
import { EmailAttachmentListComponent } from '../email-attachment-list/email-attachment-list.component';

@Component({
  selector: 'app-email-template-list',
  templateUrl: './email-template-list.component.html',
  styleUrls: ['./email-template-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class EmailTemplateListComponent {
  private readonly _api = inject(ApiService);
  private readonly _auth = inject(AuthService);
  private readonly _notifications = inject(NotificationsService);

  readonly rowActions = [
    new CustomRowAction<APISchemas['ModelsEmailTemplate']>(
      'folder_open',
      'Gérer les pièces jointes',
      'Pièces jointes',
      (row) =>
        this._notifications
          .show(EmailAttachmentListComponent, {
            data: {
              template: row,
            },
          })
          .afterClosed()
          .subscribe(() => {
            this.refresh();
          })
    ),
    new CustomRowAction<APISchemas['ModelsEmailTemplate']>(
      'preview',
      'Prévisualiser l’e-mail',
      'Prévisualiser',
      (row) =>
        this._notifications.showForm(EmailTemplatePreviewFormComponent, {
          width: '760px',
          maxWidth: 'calc(100vw - 2rem)',
          maxHeight: 'calc(100dvh - 2rem)',
          data: {
            template: row,
          },
        })
    ),
  ];

  readonly columns = [
    new Column('label', {
      label: 'Libellé',
      canSort: true,
      canFilter: true,
    }),
    new Column('subject', {
      label: 'Objet',
      canSort: true,
      canFilter: true,
    }),
    new CustomRenderColumn<APISchemas['ModelsEmailTemplate'], number>(
      'attachments',
      (row) => row.attachments?.length ?? 0,
      {
        label: 'Pièces jointes',
        canSort: true,
      }
    ),
    new Column('message', {
      hidden: true,
      canFilter: true,
    }),
  ];
  readonly datasource = new EmailTemplateDataSource();

  readonly canCreate$ = this._auth.allowed$('email.CreateEmailTemplate');

  refresh() {
    this.datasource.load();
  }

  canEdit(_: APISchemas['ModelsEmailTemplate']) {
    return this._auth.allowed$('email.UpdateEmailTemplate');
  }

  canDelete(_: APISchemas['ModelsEmailTemplate']) {
    return this._auth.allowed$('email.DeleteEmailTemplate');
  }

  edit(template?: APISchemas['ModelsEmailTemplate']) {
    this._notifications
      .showForm(EmailTemplateFormComponent, {
        width: '840px',
        maxWidth: 'calc(100vw - 2rem)',
        maxHeight: 'calc(100dvh - 2rem)',
        data: {
          template,
        },
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.refresh();
        }
      });
  }

  delete(template: APISchemas['ModelsEmailTemplate']) {
    this._notifications
      .showConfirm({
        title: 'Supprimer un modèle',
        confirmLabel: 'Supprimer',
        message: `Supprimer le modèle « ${template.label} » ?`,
        class: 'warn',
      })
      .afterClosed()
      .subscribe((confirm) => {
        if (confirm) {
          this._api.deleteEmailTemplate(template.id!).subscribe({
            next: () => {
              this.refresh();
              this._notifications.showDialog({
                title: 'Info',
                message: `Le modèle « ${template.label} » a été supprimé.`,
                level: NotificationDialogLevel.Info,
              });
            },
            error: this._api.handleError('Impossible de supprimer le modèle'),
          });
        }
      });
  }
}
