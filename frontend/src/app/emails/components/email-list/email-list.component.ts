import { Component, inject } from '@angular/core';
import { combineLatest, map } from 'rxjs';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { CustomRowAction } from 'src/app/shared/components/crud-table/crud-table.component';
import { NotificationDialogLevel } from 'src/app/shared/components/notification-dialog/notification-dialog.component';
import { Column } from 'src/app/shared/models/column.model';
import { NotificationsService } from 'src/app/shared/services/notifications.service';
import { EmailDataSource } from '../../datasources/ermail.datasource';
import { EmailViewDialogComponent } from '../email-view-dialog/email-view-dialog.component';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-email-list',
  templateUrl: './email-list.component.html',
  styleUrls: ['./email-list.component.scss'],
})
export class EmailListComponent {
  private readonly _api = inject(ApiService);
  private readonly _auth = inject(AuthService);
  private readonly _dialog = inject(MatDialog);
  private readonly _notifications = inject(NotificationsService);

  readonly rowActions$ = combineLatest([
    this._auth.allowed$('email.SendEmail'),
  ]).pipe(
    map(([sendEmail]) => {
      const actions: CustomRowAction<APISchemas['ModelsEmail']>[] = [];

      if (sendEmail) {
        actions.push(
          new CustomRowAction<APISchemas['ModelsEmail']>(
            'mail',
            'Send e-mail',
            'Send',
            (row) =>
              this._notifications
                .showConfirm({
                  title: 'Send an e-mail',
                  message: `Are you sure to send the e-mail to ${row.to}?`,
                  class: 'primary',
                })
                .afterClosed()
                .subscribe((result: boolean) => {
                  if (result) {
                    this._api
                      .sendEmail(row.id!, {
                        wait: true,
                      })
                      .subscribe({
                        next: () => {
                          this.refresh();
                          this._notifications.showDialog({
                            title: 'E-mail sent',
                            message: `E-mail to ${row.to} has been successfully sent`,
                            level: NotificationDialogLevel.Info,
                          });
                        },
                        error: (e) => {
                          this._notifications.showDialog({
                            title: 'Error',
                            message: `Unable to send the e-mail: ${e}`,
                            level: NotificationDialogLevel.Error,
                          });
                        },
                      });
                  }
                }),
            (row) => ['SENT', 'READ'].indexOf(row.state ?? '') === -1
          )
        );
      }

      return actions;
    })
  );

  readonly columns = [
    new Column('subject', {
      label: 'Subject',
      canSort: true,
      canFilter: true,
    }),
    new Column('to', {
      label: 'Recipient',
      canSort: true,
      canFilter: true,
    }),
    new Column('state', {
      label: 'State',
      canSort: true,
      canFilter: true,
    }),
    new Column('message', {
      label: '',
      canFilter: true,
    }),
  ];
  readonly datasource = new EmailDataSource();

  refresh() {
    this.datasource.load();
  }

  canDelete(_: APISchemas['ModelsEmail']) {
    return this._auth.allowed$('email.DeleteEmail');
  }

  delete(email: APISchemas['ModelsEmail']) {
    this._notifications
      .showConfirm({
        title: 'Delete an e-mail',
        message: `Are you sure to delete the e-mail to ${email.to}?`,
        class: 'warn',
      })
      .afterClosed()
      .subscribe((confirm: boolean) => {
        if (confirm) {
          this._api.deleteEmail(email.id!).subscribe({
            next: () => {
              this.refresh();
              this._notifications.showDialog({
                title: 'Info',
                message: `The e-mail ${email.id} has been deleted`,
                level: NotificationDialogLevel.Info,
              });
            },
            error: (e) => {
              this._notifications.showDialog({
                title: 'Error',
                message: `Unable to delete the e-mail: ${e}`,
                level: NotificationDialogLevel.Error,
              });
            },
          });
        }
      });
  }

  show(email: APISchemas['ModelsEmail']) {
    this._dialog.open(EmailViewDialogComponent, {
      width: '800px',
      data: {
        email,
      },
    });
  }
}
