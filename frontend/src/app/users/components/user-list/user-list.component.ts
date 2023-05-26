import { Component, inject } from '@angular/core';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { NotificationDialogLevel } from 'src/app/shared/components/notification-dialog/notification-dialog.component';
import { Column } from 'src/app/shared/models/column.model';
import { NotificationsService } from 'src/app/shared/services/notifications.service';
import { UserDataSource } from '../../datasources/user.datasource';
import { UserFormComponent } from '../user-form/user-form.component';

@Component({
  selector: 'app-user-list',
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.scss'],
})
export class UserListComponent {
  private readonly _api = inject(ApiService);
  private readonly _auth = inject(AuthService);
  private readonly _notifications = inject(NotificationsService);

  readonly columns = [
    new Column('username', {
      label: 'Username',
      canSort: true,
      canFilter: true,
    }),
    new Column('enabled', {
      label: 'Enabled',
      canSort: true,
    }),
    new Column('admin', {
      label: 'Administrator',
      canSort: true,
    }),
    new Column<string[] | undefined>('actions', {
      label: 'Action(s)',
      render: (actions) => (actions ?? []).length + '',
    }),
  ];
  readonly datasource = new UserDataSource();

  readonly canCreate$ = this._auth.administrator$;

  refresh() {
    this.datasource.load();
  }

  canEdit(_: APISchemas['AuthUser']) {
    return this._auth.administrator$;
  }

  canDelete(_: APISchemas['AuthUser']) {
    return this._auth.administrator$;
  }

  edit(user?: APISchemas['AuthUser']) {
    this._notifications
      .showForm(UserFormComponent, {
        data: {
          user,
        },
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.refresh();
        }
      });
  }

  delete(user: APISchemas['AuthUser']) {
    this._notifications
      .showConfirm({
        title: 'Delete a user',
        message: `Are you sure to delete the user ${user.username}?`,
        class: 'warn',
      })
      .afterClosed()
      .subscribe((confirm) => {
        if (confirm) {
          this._api.deleteUser(user.id!).subscribe({
            next: () => {
              this.refresh();
              this._notifications.showDialog({
                title: 'Info',
                message: `The user ${user.username} has been deleted`,
                level: NotificationDialogLevel.Info,
              });
            },
            error: this._api.handleError('Unable to delete the user'),
          });
        }
      });
  }
}
