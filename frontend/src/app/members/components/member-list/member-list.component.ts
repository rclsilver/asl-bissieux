import { Component, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { NotificationDialogLevel } from 'src/app/shared/components/notification-dialog/notification-dialog.component';
import { Column } from 'src/app/shared/models/column.model';
import { NotificationsService } from 'src/app/shared/services/notifications.service';
import { MemberDataSource } from '../../datasources/member.datasource';
import { MemberFormComponent } from '../member-form/member-form.component';

@Component({
  selector: 'app-member-list',
  templateUrl: './member-list.component.html',
  styleUrls: ['./member-list.component.scss'],
})
export class MemberListComponent {
  private readonly _api = inject(ApiService);
  private readonly _auth = inject(AuthService);
  private readonly _dialog = inject(MatDialog);
  private readonly _notifications = inject(NotificationsService);

  readonly columns = [
    new Column('first_name', {
      label: 'First name',
      canSort: true,
    }),
    new Column('last_name', {
      label: 'Last name',
      canSort: true,
    }),
    new Column('address', {
      label: 'Address',
    }),
    new Column('phone_number', {
      label: 'Phone number',
    }),
    new Column('email', {
      label: 'E-mail address',
    }),
    new Column<APISchemas['ModelsUnit'][]>('units', {
      label: 'Unit(s)',
      render: (units) => (units ?? []).map((unit) => unit.number).join(', '),
      canSort: true,
      sortFunc: (a, b) => {
        const aMinNumber = Math.min(...a.map((unit) => unit.number ?? 0));
        const bMinNumber = Math.min(...b.map((unit) => unit.number ?? 0));

        if (aMinNumber === 0) {
          return 0;
        } else if (aMinNumber < bMinNumber) {
          return 1;
        } else {
          return -1;
        }
      },
    }),
  ];
  readonly datasource = new MemberDataSource();

  readonly canCreate$ = this._auth.allowed$('member.CreateMember');

  refresh() {
    this.datasource.load();
  }

  canEdit(_: APISchemas['ModelsMember']) {
    return this._auth.allowed$('member.MemberUnit');
  }

  canDelete(_: APISchemas['ModelsMember']) {
    return this._auth.allowed$('member.DeleteMember');
  }

  edit(member?: APISchemas['ModelsMember']) {
    this._dialog
      .open(MemberFormComponent, {
        width: '800px',
        data: {
          member,
        },
      })
      .afterClosed()
      .subscribe((result: boolean) => {
        if (result) {
          this.refresh();
        }
      });
  }

  delete(member: APISchemas['ModelsMember']) {
    this._notifications
      .showConfirm({
        title: 'Delete a member',
        message: `Are you sure to delete the member ${member.first_name} ${member.last_name}?`,
        class: 'warn',
      })
      .afterClosed()
      .subscribe((confirm: boolean) => {
        if (confirm) {
          this._api.deleteMember(member.id!).subscribe({
            next: () => {
              this.refresh();
              this._notifications.showDialog({
                title: 'Info',
                message: `The member ${member.first_name} ${member.last_name} has been deleted`,
                level: NotificationDialogLevel.Info,
              });
            },
            error: (e) => {
              this._notifications.showDialog({
                title: 'Error',
                message: `Unable to delete the member: ${e}`,
                level: NotificationDialogLevel.Error,
              });
            },
          });
        }
      });
  }
}
