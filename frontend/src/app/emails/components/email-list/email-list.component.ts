import {
  AfterViewInit,
  Component,
  OnDestroy,
  ViewChild,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  BehaviorSubject,
  Subject,
  combineLatest,
  first,
  forkJoin,
  map,
  takeUntil,
  shareReplay,
  switchMap,
  of,
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
import { EmailDataSource } from '../../datasources/email.datasource';
import { EmailTemplatePreviewComponent } from '../email-template-preview/email-template-preview.component';
import { ActivatedRoute } from '@angular/router';
import { EmptyDataSource } from 'src/app/shared/datasources/empty.datasource';
import { DataSource } from 'src/app/shared/datasources';
import { EmailSendingPopupComponent } from '../email-sending-popup/email-sending-popup.component';
import {
  canSendEmail,
  canResetEmail,
  emailStateLabel,
} from '../../email-state';

@Component({
  selector: 'app-email-list',
  templateUrl: './email-list.component.html',
  styleUrls: ['./email-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class EmailListComponent implements AfterViewInit, OnDestroy {
  readonly stateLabel = emailStateLabel;
  private _destroyed$ = new Subject<void>();

  private readonly _api = inject(ApiService);
  private readonly _auth = inject(AuthService);
  private readonly _notifications = inject(NotificationsService);
  private readonly _route = inject(ActivatedRoute);

  readonly rowActions$ = combineLatest([
    this._auth.allowed$('email.SendEmail'),
    this._auth.allowed$('email.SetError'),
  ]).pipe(
    map(([sendEmail, setError]) => {
      const actions: CustomRowAction<APISchemas['ModelsEmail']>[] = [];

      if (sendEmail) {
        actions.push(
          new CustomRowAction<APISchemas['ModelsEmail']>(
            'mail',
            'Envoyer l’e-mail',
            'Envoyer',
            (row) =>
              this._notifications
                .showConfirm({
                  title: 'Envoyer un e-mail',
                  confirmLabel: 'Envoyer',
                  message: `Envoyer l’e-mail à ${row.to} ?`,
                  class: 'primary',
                })
                .afterClosed()
                .subscribe((result) => {
                  if (result) {
                    this._notifications
                      .showForm(EmailSendingPopupComponent, {
                        width: '50%',
                        data: {
                          emails: [row],
                        },
                      })
                      .afterClosed()
                      .subscribe(() => this.refresh());
                  }
                }),
            (row) => this._canSend(row)
          )
        );
      }

      if (setError) {
        actions.push(
          new CustomRowAction<APISchemas['ModelsEmail']>(
            'sms_failed',
            'Autoriser un nouvel envoi après vérification',
            'Autoriser un renvoi',
            (row) =>
              this._notifications
                .showConfirm({
                  title: 'Autoriser un renvoi',
                  confirmLabel: 'Autoriser le renvoi',
                  message:
                    row.state === 'UNKNOWN'
                      ? `Le résultat de l’envoi à ${row.to} est incertain. Vérifie d’abord sa réception pour éviter un doublon. Après vérification, confirmes-tu qu’un nouvel envoi est nécessaire ?`
                      : `Ce message à ${row.to} a déjà été envoyé. Confirmes-tu qu’un nouvel envoi est nécessaire ?`,
                  class: 'primary',
                })
                .afterClosed()
                .subscribe((result) => {
                  if (result) {
                    this._api.emailSetError(row.id!).subscribe({
                      next: () => {
                        this.refresh();
                        this._notifications.showDialog({
                          title: 'Renvoi autorisé',
                          message: `Tu peux maintenant renvoyer le message à ${row.to}.`,
                          level: NotificationDialogLevel.Info,
                        });
                      },
                      error: this._api.handleError(
                        'Impossible de modifier l’état de l’e-mail'
                      ),
                    });
                  }
                }),
            (row) => canResetEmail(row.state)
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
      label: 'Objet',
      canSort: true,
      canFilter: true,
    }),
    new Column('to', {
      label: 'Destinataire',
      canSort: true,
      canFilter: true,
    }),
    new Column('state', {
      label: 'État',
      canSort: true,
      canFilter: true,
    }),
    new Column('message', {
      label: '',
      canFilter: true,
    }),
  ];
  readonly campaign$ = this._route.paramMap.pipe(
    switchMap((params) =>
      params.get('id')
        ? this._api.getEmailCampaign(params.get('id')!)
        : of(null)
    ),
    shareReplay(1)
  );
  private _emails$ = new BehaviorSubject<DataSource<APISchemas['ModelsEmail']>>(
    new EmptyDataSource<APISchemas['ModelsEmail']>()
  );
  readonly emails$ = this._emails$.asObservable();

  @ViewChild(CrudTableComponent, { static: false })
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
          canDelete && selected.some((row) => row.state !== 'SENDING'),
          canSend && selected.filter((row) => this._canSend(row)).length > 0,
        ])
      )
      .subscribe(([canDelete, canSend]) => {
        const actions: CustomToolbarAction[] = [];

        if (canDelete) {
          actions.push({
            icon: 'delete',
            tooltip: 'Supprimer les e-mails sélectionnés',
            func: this.bulkDelete.bind(this),
          });
        }

        if (canSend) {
          actions.push({
            icon: 'mail',
            tooltip: 'Envoyer les e-mails sélectionnés',
            func: this.bulkSend.bind(this),
          });
        }

        this._toolbarActions$.next(actions);
      });

    this.campaign$.pipe(takeUntil(this._destroyed$)).subscribe((campaign) => {
      if (campaign) {
        this._emails$.next(new EmailDataSource(this._api, campaign.id!));
      } else {
        this._emails$.next(new EmptyDataSource<APISchemas['ModelsEmail']>());
      }
    });
  }

  ngOnDestroy() {
    this._destroyed$.next();
    this._destroyed$.complete();
  }

  refresh() {
    this._emails$.value.load();
  }

  canDelete(row: APISchemas['ModelsEmail']) {
    if (row.state === 'SENDING') {
      return of(false);
    }
    return this._auth.allowed$('email.DeleteEmail');
  }

  delete(email: APISchemas['ModelsEmail']) {
    this._notifications
      .showConfirm({
        title: 'Supprimer un e-mail',
        confirmLabel: 'Supprimer',
        message: `Supprimer l’e-mail destiné à ${email.to} ?`,
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
                message: `L’e-mail destiné à ${email.to} a été supprimé.`,
                level: NotificationDialogLevel.Info,
              });
            },
            error: this._api.handleError('Impossible de supprimer l’e-mail'),
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
        title: 'Supprimer la sélection',
        confirmLabel: 'Supprimer',
        message:
          'Supprimer les e-mails sélectionnés ? Les messages en cours d’envoi seront conservés.',
        class: 'warn',
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.table.selected.selected$.pipe(first()).subscribe((selected) => {
            const calls$ = selected
              .filter((row) => row.state !== 'SENDING')
              .map((row) => this._api.deleteEmail(row.id!));

            forkJoin(calls$).subscribe(() => {
              this.refresh();
              this._notifications.showDialog({
                title: 'Supprimer la sélection',
                message:
                  'Les e-mails sélectionnés hors envoi en cours ont été supprimés.',
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
        title: 'Envoyer la sélection',
        confirmLabel: 'Envoyer',
        message:
          'Confirmer l’envoi des e-mails sélectionnés ? Seuls les messages dont l’état autorise l’envoi seront pris en compte.',
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
              this._notifications
                .showForm(EmailSendingPopupComponent, {
                  width: '50%',
                  data: {
                    emails: selected,
                  },
                })
                .afterClosed()
                .subscribe(() => this.refresh());
            });
        }
      });
  }

  private _canSend(row: APISchemas['ModelsEmail']) {
    return canSendEmail(row.state);
  }
}
