import { Component, inject } from '@angular/core';
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

@Component({
  selector: 'app-email-template-list',
  templateUrl: './email-template-list.component.html',
  styleUrls: ['./email-template-list.component.scss'],
})
export class EmailTemplateListComponent {
  private readonly _api = inject(ApiService);
  private readonly _auth = inject(AuthService);
  private readonly _notifications = inject(NotificationsService);

  readonly rowActions = [
    new CustomRowAction<APISchemas['ModelsEmailTemplate']>(
      'preview',
      'Preview the e-mail',
      'Preview',
      (row) =>
        this._notifications.showForm(EmailTemplatePreviewFormComponent, {
          data: {
            template: row,
          },
        })
    ),
  ];

  readonly columns = [
    new Column('label', {
      label: 'Label',
      canSort: true,
      canFilter: true,
    }),
    new Column('subject', {
      label: 'Subject',
      canSort: true,
      canFilter: true,
    }),
    new CustomRenderColumn<APISchemas['ModelsEmailTemplate'], number>(
      'attachments',
      (row) => row.attachments?.length ?? 0,
      {
        label: 'Attachments',
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

  show(template: APISchemas['ModelsEmailTemplate']) {
    console.log(template);
  }

  edit(template?: APISchemas['ModelsEmailTemplate']) {
    this._notifications
      .showForm(EmailTemplateFormComponent, {
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
        title: 'Delete a template',
        message: `Are you sure to delete the template ${template.label}?`,
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
                message: `The template ${template.label} has been deleted`,
                level: NotificationDialogLevel.Info,
              });
            },
            error: this._api.handleError('Unable to delete the template'),
          });
        }
      });
  }
}
