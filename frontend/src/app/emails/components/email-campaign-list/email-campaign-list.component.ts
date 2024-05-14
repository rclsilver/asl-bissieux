import { Component, ViewChild, inject } from '@angular/core';
import { combineLatest, map } from 'rxjs';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { AuthService } from 'src/app/core/services/auth.service';
import {
  CrudTableComponent,
  CustomRowAction,
} from 'src/app/shared/components/crud-table/crud-table.component';
import { NotificationDialogLevel } from 'src/app/shared/components/notification-dialog/notification-dialog.component';
import { Column, DateRender } from 'src/app/shared/models/column.model';
import { NotificationsService } from 'src/app/shared/services/notifications.service';
import { EmailCampaignDataSource } from '../../datasources/campaign.datasource';

@Component({
  selector: 'app-campaign-email-list',
  templateUrl: './email-campaign-list.component.html',
  styleUrls: ['./email-campaign-list.component.scss'],
})
export class EmailCampaignListComponent {
  private readonly _api = inject(ApiService);
  private readonly _auth = inject(AuthService);
  private readonly _notifications = inject(NotificationsService);

  readonly columns = [
    new Column('title', {
      label: 'Title',
      canSort: true,
      canFilter: true,
      routeTo: (v) => {
        return `/emails/campaigns/${v.id}`;
      },
    }),
    new Column('created_at', {
      label: 'Date',
      canSort: true,
      render: DateRender(),
    }),
    new Column<APISchemas['ModelsEmail'][] | undefined>('emails', {
      label: 'Emails',
      render: (emails) => {
        var byState = (emails ?? [])
          .map((email) => ({
            [email.state!]: 1,
          }))
          .reduce((acc, val) => {
            Object.keys(val).forEach((key) => {
              if (acc[key]) {
                acc[key] += val[key];
              } else {
                acc[key] = 1;
              }
            });

            return acc;
          }, {});

        return Object.keys(byState)
          .sort((a, b) => (a < b ? -1 : 1))
          .map((key) => `${byState[key]} ${key}`)
          .join(' / ');
      },
    }),
  ];
  readonly datasource = new EmailCampaignDataSource();

  @ViewChild(CrudTableComponent, { static: true })
  table!: CrudTableComponent<APISchemas['ModelsEmail']>;

  refresh() {
    this.datasource.load();
  }

  canDelete(_: APISchemas['ModelsEmail']) {
    return this._auth.allowed$('email.DeleteEmailCampaign');
  }

  delete(campaign: APISchemas['ModelsEmailCampaign']) {
    this._notifications
      .showConfirm({
        title: 'Delete a campaign',
        message: `Are you sure to delete the campaign ${campaign.title}?`,
        class: 'warn',
      })
      .afterClosed()
      .subscribe((confirm) => {
        if (confirm) {
          this._api.deleteEmailCampaign(campaign.id!).subscribe({
            next: () => {
              this.refresh();
              this._notifications.showDialog({
                title: 'Info',
                message: `The campaign ${campaign.title} has been deleted`,
                level: NotificationDialogLevel.Info,
              });
            },
            error: this._api.handleError('Unable to delete the campaign'),
          });
        }
      });
  }
}
