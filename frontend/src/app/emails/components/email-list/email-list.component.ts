import {
  AfterViewInit,
  Component,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';
import {
  BehaviorSubject,
  Subject,
  combineLatest,
  first,
  forkJoin,
  map,
  takeUntil,
} from 'rxjs';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { AuthService } from 'src/app/core/services/auth.service';
import {
  CrudTableComponent,
  CustomRowAction,
  CustomToolbarAction,
} from 'src/app/shared/components/crud-table/crud-table.component';
import { NotificationDialogLevel } from 'src/app/shared/components/notification-dialog/notification-dialog.component';
import { Column } from 'src/app/shared/models/column.model';
import { NotificationsService } from 'src/app/shared/services/notifications.service';
import { EmailDataSource } from '../../datasources/ermail.datasource';
import { EmailTemplatePreviewComponent } from '../email-template-preview/email-template-preview.component';

@Component({
  selector: 'app-email-list',
  templateUrl: './email-list.component.html',
  styleUrls: ['./email-list.component.scss'],
})
export class EmailListComponent implements AfterViewInit, OnDestroy {
  private _destroyed$ = new Subject<void>();

  private readonly _api = inject(ApiService);
  private readonly _auth = inject(AuthService);
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
                .subscribe((result) => {
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
                        error: this._api.handleError(
                          'Unable to send the e-mail'
                        ),
                      });
                  }
                }),
            (row) => this._canSend(row)
          )
        );
      }

      return actions;
    })
  );

  private _toolbarActions$ = new BehaviorSubject<CustomToolbarAction[]>([]);
  readonly toolbarActions$ = this._toolbarActions$.asObservable();

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

  @ViewChild(CrudTableComponent, { static: true })
  table!: CrudTableComponent<APISchemas['ModelsEmail']>;

  ngAfterViewInit() {
    combineLatest([
      this._auth.allowed$('email.DeleteEmail'),
      this._auth.allowed$('email.SendEmail'),
      this.table.selected.selected$,
    ])
      .pipe(
        takeUntil(this._destroyed$),
        map(([canDelete, canSend, selected]) => [
          canDelete && selected.length > 0,
          canSend && selected.filter((row) => this._canSend(row)).length > 0,
        ])
      )
      .subscribe(([canDelete, canSend]) => {
        const actions: CustomToolbarAction[] = [];

        if (canDelete) {
          actions.push({
            icon: 'trash',
            tooltip: 'Bulk delete',
            func: this.bulkDelete.bind(this),
          });
        }

        if (canSend) {
          actions.push({
            icon: 'envelope',
            tooltip: 'Bulk send',
            func: this.bulkSend.bind(this),
          });
        }

        this._toolbarActions$.next(actions);
      });
  }

  ngOnDestroy() {
    this._destroyed$.next();
    this._destroyed$.complete();
  }

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
      .subscribe((confirm) => {
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
            error: this._api.handleError('Unable to delete the e-mail'),
          });
        }
      });
  }

  show(email: APISchemas['ModelsEmail']) {
    this._notifications.show(EmailTemplatePreviewComponent, {
      data: {
        subject: email.subject,
        message: email.message,
      },
    });
  }

  bulkDelete() {
    this._notifications
      .showConfirm({
        title: 'Bulk delete',
        message: 'Are you sure to want to delete all the selected e-mails?',
        class: 'warn',
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.table.selected.selected$.pipe(first()).subscribe((selected) => {
            const calls$ = selected.map((row) =>
              this._api.deleteEmail(row.id!)
            );

            forkJoin(calls$).subscribe(() => {
              this.refresh();
              this._notifications.showDialog({
                title: 'Bulk delete',
                message: 'All the selected e-mails have been deleted',
                level: NotificationDialogLevel.Info,
              });
            });
          });
        }
      });
  }

  bulkSend() {
    this._notifications
      .showConfirm({
        title: 'Bulk send',
        message: 'Are you sure to want to send all the selected e-mails?',
        class: 'primary',
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.table.selected.selected$
            .pipe(
              first(),
              map((selected) => selected.filter((row) => this._canSend(row)))
            )
            .subscribe((selected) => {
              const calls$ = selected.map((row) =>
                this._api.sendEmail(row.id!, { wait: false })
              );

              forkJoin(calls$).subscribe(() => {
                this.refresh();
                this._notifications.showDialog({
                  title: 'Bulk send',
                  message: 'All the selected e-mails have been sent',
                  level: NotificationDialogLevel.Info,
                });
              });
            });
        }
      });
  }

  private _canSend(row: APISchemas['ModelsEmail']) {
    return ['SENT', 'READ'].indexOf(row.state ?? '') === -1;
  }
}
