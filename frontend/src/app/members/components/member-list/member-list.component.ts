import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
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
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class MemberListComponent {
  private readonly _api = inject(ApiService);
  private readonly _auth = inject(AuthService);
  private readonly _notifications = inject(NotificationsService);

  readonly columns = [
    new Column('first_name', {
      label: 'Prénom',
      canSort: true,
      canFilter: true,
    }),
    new Column('last_name', {
      label: 'Nom',
      canSort: true,
      canFilter: true,
    }),
    new Column('address', {
      label: 'Adresse',
      canFilter: true,
    }),
    new Column('phone_number', {
      label: 'Téléphone',
      canFilter: true,
    }),
    new Column('email', {
      label: 'E-mail',
      canFilter: true,
    }),
    new Column<APISchemas['ModelsUnit'][]>('units', {
      label: 'Lots',
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
      canFilter: true,
      filterFunc: (units, pattern) => {
        if (!pattern) {
          return true;
        }

        for (let unit of units) {
          if ((unit.number ?? 0).toString().indexOf(pattern) !== -1) {
            return true;
          }
        }

        return false;
      },
    }),
  ];
  readonly rowLabel = (member: APISchemas['ModelsMember']) =>
    [member.first_name, member.last_name].filter(Boolean).join(' ');
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
    this._notifications
      .showForm(MemberFormComponent, {
        data: {
          member,
        },
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.refresh();
        }
      });
  }

  delete(member: APISchemas['ModelsMember']) {
    this._notifications
      .showConfirm({
        title: 'Supprimer un membre',
        confirmLabel: 'Supprimer',
        message: `Supprimer le membre ${member.first_name} ${member.last_name} ?`,
        class: 'warn',
      })
      .afterClosed()
      .subscribe((confirm) => {
        if (confirm) {
          this._api.deleteMember(member.id!).subscribe({
            next: () => {
              this.refresh();
              this._notifications.showDialog({
                title: 'Info',
                message: `Le membre ${member.first_name} ${member.last_name} a été supprimé.`,
                level: NotificationDialogLevel.Info,
              });
            },
            error: this._api.handleError('Impossible de supprimer le membre'),
          });
        }
      });
  }
}
