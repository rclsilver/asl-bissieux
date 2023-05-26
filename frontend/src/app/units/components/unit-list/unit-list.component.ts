import { Component, inject } from '@angular/core';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { NotificationsService } from 'src/app/shared/services/notifications.service';
import { UnitDataSource } from '../../datasources/unit.datasource';
import { UnitFormComponent } from '../unit-form/unit-form.component';
import { NotificationDialogLevel } from 'src/app/shared/components/notification-dialog/notification-dialog.component';
import { Column } from 'src/app/shared/models/column.model';

@Component({
  selector: 'app-unit-list',
  templateUrl: './unit-list.component.html',
  styleUrls: ['./unit-list.component.scss'],
})
export class UnitListComponent {
  private readonly _api = inject(ApiService);
  private readonly _auth = inject(AuthService);
  private readonly _notifications = inject(NotificationsService);

  readonly columns = [
    new Column('number', {
      label: 'Number',
      canSort: true,
      defaultSort: true,
      canFilter: true,
    }),
    new Column('share', {
      label: 'Share',
      canSort: true,
    }),
    new Column('address', {
      label: 'Address',
      canFilter: true,
    }),
  ];
  readonly datasource = new UnitDataSource();

  readonly canCreate$ = this._auth.allowed$('unit.CreateUnit');

  refresh() {
    this.datasource.load();
  }

  canEdit(_: APISchemas['ModelsUnit']) {
    return this._auth.allowed$('unit.UpdateUnit');
  }

  canDelete(_: APISchemas['ModelsUnit']) {
    return this._auth.allowed$('unit.DeleteUnit');
  }

  edit(unit?: APISchemas['CreateUnitInput'] | APISchemas['UpdateUnitInput']) {
    this._notifications
      .showForm(UnitFormComponent, {
        data: {
          unit,
        },
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.refresh();
        }
      });
  }

  delete(unit: APISchemas['ModelsUnit']) {
    this._notifications
      .showConfirm({
        title: 'Delete an unit',
        message: `Are you sure to delete the unit ${unit.number}?`,
        class: 'warn',
      })
      .afterClosed()
      .subscribe((confirm) => {
        if (confirm) {
          this._api.deleteUnit(unit.id!).subscribe({
            next: () => {
              this.refresh();
              this._notifications.showDialog({
                title: 'Info',
                message: `The unit ${unit.number} has been deleted`,
                level: NotificationDialogLevel.Info,
              });
            },
            error: this._api.handleError('Unable to delete the unit'),
          });
        }
      });
  }
}
