import {
  AfterViewInit,
  OnInit,
  Component,
  OnDestroy,
  ViewChild,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  BehaviorSubject,
  Subject,
  Observable,
  catchError,
  combineLatest,
  finalize,
  first,
  forkJoin,
  map,
  of,
  shareReplay,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { AuthService } from 'src/app/core/services/auth.service';
import {
  CrudTableComponent,
  CustomRowAction,
  CustomToolbarAction,
} from 'src/app/shared/components/crud-table/crud-table.component';
import { ConfirmDialogData } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';
import { NotificationDialogLevel } from 'src/app/shared/components/notification-dialog/notification-dialog.component';
import { Column, DateRender } from 'src/app/shared/models/column.model';
import { NotificationsService } from 'src/app/shared/services/notifications.service';
import { DataSource } from 'src/app/shared/datasources';
import { EmptyDataSource } from 'src/app/shared/datasources/empty.datasource';
import { EmailDataSource } from '../../datasources/email.datasource';
import { EmailTemplatePreviewComponent } from '../email-template-preview/email-template-preview.component';
import { EmailSendingPopupComponent } from '../email-sending-popup/email-sending-popup.component';
import {
  canSendEmail,
  canResetEmail,
  emailStateLabel,
} from '../../email-state';

type Email = APISchemas['ModelsEmailSummary'];

@Component({
  selector: 'app-email-list',
  templateUrl: './email-list.component.html',
  styleUrls: ['./email-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class EmailListComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly destroyed = new Subject<void>();
  private readonly scopeChanged = new Subject<void>();
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private routeState = '';
  private readonly campaignReload = new BehaviorSubject(0);
  private readonly source = new BehaviorSubject<DataSource<Email>>(
    new EmptyDataSource<Email>()
  );
  readonly emails$ = this.source.asObservable();
  private visible: readonly Email[] = [];
  private revision = 0;
  private alive = true;
  loading = false;
  campaignLoading = true;
  campaignError = false;
  busyAction = false;
  previewingId: string | null = null;
  state = '';
  readonly states = ['WAITING', 'SENDING', 'SENT', 'READ', 'ERROR', 'UNKNOWN'];
  readonly stateLabel = (state: string | undefined) =>
    state === 'READ' ? 'Signal d’ouverture' : emailStateLabel(state);

  readonly campaign$ = combineLatest([
    this.route.paramMap,
    this.campaignReload,
  ]).pipe(
    tap(() => {
      this.campaignLoading = true;
      this.campaignError = false;
      this.revision++;
      this.scopeChanged.next();
      this.table?.selected.clear();
    }),
    switchMap(([params]) => {
      const id = params.get('id');
      if (!id) {
        this.campaignError = true;
        return of(null);
      }
      return this.api.getEmailCampaign(id).pipe(
        catchError(() => {
          this.campaignError = true;
          return of(null);
        })
      );
    }),
    tap(() => (this.campaignLoading = false)),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly columns = [
    new Column('subject', {
      label: 'Objet',
      render: (value) => value || 'Objet indisponible',
    }),
    new Column('to', { label: 'Destinataire', canSort: true, canFilter: true }),
    new Column('created_at', {
      label: 'Préparé le',
      canSort: true,
      render: DateRender(),
    }),
    new Column('state', { label: 'État', canSort: true }),
    new Column('message', { label: '' }),
  ];
  readonly rowActions$ = combineLatest([
    this.auth.allowed$('email.SendEmail'),
    this.auth.allowed$('email.SetError'),
  ]).pipe(
    map(([send, reset]) => {
      const actions: CustomRowAction<Email>[] = [];
      if (send)
        actions.push(
          new CustomRowAction(
            'mail',
            'Envoyer l’e-mail',
            'Envoyer',
            (row) => this.sendOne(row),
            (row) => canSendEmail(row.state),
            (row) => !this.isUsable(row)
          )
        );
      if (reset)
        actions.push(
          new CustomRowAction(
            'sms_failed',
            'Autoriser un nouvel envoi après vérification',
            'Autoriser un renvoi',
            (row) => this.resetOne(row),
            (row) => canResetEmail(row.state),
            (row) => !this.isUsable(row)
          )
        );
      return actions;
    })
  );
  private readonly toolbar = new BehaviorSubject<CustomToolbarAction[]>([]);
  readonly toolbarActions$ = this.toolbar.asObservable();

  @ViewChild(CrudTableComponent, { static: false })
  table!: CrudTableComponent<Email>;

  ngOnInit() {
    this.route.queryParamMap.pipe(takeUntil(this.destroyed)).subscribe((p) => {
      const state = p.get('state') ?? '';
      this.routeState = this.states.includes(state) ? state : '';
      this.state = this.routeState;
      const source = this.source.value;
      if (source instanceof EmailDataSource) source.setState(this.state);
    });
  }

  ngAfterViewInit() {
    this.source
      .pipe(
        switchMap((source) => source.results$),
        takeUntil(this.destroyed)
      )
      .subscribe((rows) => (this.visible = rows));
    this.source
      .pipe(
        switchMap((source) => source.loading$),
        takeUntil(this.destroyed)
      )
      .subscribe((loading) => {
        this.loading = loading;
        if (loading) {
          this.revision++;
          this.scopeChanged.next();
        }
      });
    combineLatest([
      this.auth.allowed$('email.DeleteEmail'),
      this.auth.allowed$('email.SendEmail'),
      this.table.selected.selected$,
    ])
      .pipe(takeUntil(this.destroyed))
      .subscribe(([canDelete, canSend, selected]) => {
        const actions: CustomToolbarAction[] = [];
        if (canDelete && selected.some((row) => row.state !== 'SENDING'))
          actions.push({
            icon: 'delete',
            tooltip: 'Supprimer les e-mails sélectionnés sur cette page',
            func: () => this.bulkDelete(),
          });
        if (canSend && selected.some((row) => canSendEmail(row.state)))
          actions.push({
            icon: 'mail',
            tooltip: 'Envoyer les e-mails sélectionnés sur cette page',
            func: () => this.bulkSend(),
          });
        this.toolbar.next(actions);
      });
    this.campaign$.pipe(takeUntil(this.destroyed)).subscribe((campaign) => {
      this.state = this.routeState;
      if (this.table.search.pattern)
        this.table.search.clear(new UIEvent('change'));
      this.source.next(
        campaign?.id
          ? new EmailDataSource(this.api, campaign.id, this.state)
          : new EmptyDataSource<Email>()
      );
    });
  }

  ngOnDestroy() {
    this.alive = false;
    this.destroyed.next();
    this.destroyed.complete();
    this.scopeChanged.complete();
    this.toolbar.complete();
    this.campaignReload.complete();
    this.source.complete();
  }
  reloadCampaign() {
    this.campaignReload.next(this.campaignReload.value + 1);
  }
  refresh() {
    if (this.alive) this.source.value.load();
  }
  setState(state: string) {
    this.routeState = state;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { state: state || null },
      queryParamsHandling: 'merge',
    });
    this.state = state;
    const source = this.source.value;
    if (source instanceof EmailDataSource) source.setState(state);
  }
  private get canAct() {
    return (
      !this.loading &&
      !this.campaignLoading &&
      !this.campaignError &&
      !this.busyAction
    );
  }
  private isUsable(row: Email) {
    return (
      this.canAct &&
      !!row.id &&
      this.visible.some(
        (item) => item.id === row.id && item.state === row.state
      )
    );
  }
  canDelete(row: Email) {
    return !this.isUsable(row) || row.state === 'SENDING'
      ? of(false)
      : this.auth.allowed$('email.DeleteEmail');
  }

  private confirmRows(
    rows: Email[],
    config: ConfirmDialogData,
    action: (rows: Email[]) => void
  ) {
    if (!rows.length || !rows.every((row) => this.isUsable(row))) return;
    const frozen = rows.map((row) => ({ ...row })),
      revision = this.revision;
    this.notifications
      .showConfirm(config)
      .afterClosed()
      .pipe(takeUntil(this.destroyed))
      .subscribe((confirmed) => {
        if (!confirmed) return;
        if (
          revision !== this.revision ||
          !frozen.every((row) => this.isUsable(row))
        ) {
          this.notifications.showDialog({
            title: 'La liste a changé',
            message:
              'Vérifie la page et sélectionne à nouveau les e-mails à traiter.',
            level: NotificationDialogLevel.Info,
          });
          return;
        }
        action(frozen);
      });
  }
  delete(row: Email) {
    if (row.state === 'SENDING') return;
    this.confirmRows(
      [row],
      {
        title: 'Supprimer un e-mail',
        confirmLabel: 'Supprimer',
        message: `Supprimer l’e-mail destiné à ${row.to} ?`,
        class: 'warn',
      },
      (rows) => this.deleteRows(rows)
    );
  }
  bulkDelete() {
    this.table.selected.selected$
      .pipe(first(), takeUntil(this.destroyed))
      .subscribe((selected) =>
        this.confirmRows(
          selected.filter((row) => row.state !== 'SENDING'),
          {
            title: 'Supprimer la sélection',
            confirmLabel: 'Supprimer',
            message:
              'Supprimer les e-mails sélectionnés sur cette page ? Les messages en cours d’envoi seront conservés.',
            class: 'warn',
          },
          (rows) => this.deleteRows(rows)
        )
      );
  }
  private deleteRows(rows: Email[]) {
    this.busyAction = true;
    forkJoin(rows.map((row) => this.api.deleteEmail(row.id!)))
      .pipe(
        takeUntil(this.destroyed),
        finalize(() => {
          this.busyAction = false;
          this.refresh();
        })
      )
      .subscribe({
        next: () =>
          this.notifications.showDialog({
            title: 'Suppression terminée',
            message:
              'Les e-mails sélectionnés hors envoi en cours ont été supprimés.',
            level: NotificationDialogLevel.Info,
          }),
        error: this.api.handleError(
          'La suppression de certains e-mails a échoué'
        ),
      });
  }
  private sendOne(row: Email) {
    if (!canSendEmail(row.state)) return;
    this.confirmRows(
      [row],
      {
        title: 'Envoyer un e-mail',
        confirmLabel: 'Envoyer',
        message: `Envoyer l’e-mail à ${row.to} ?`,
        class: 'primary',
      },
      (rows) => this.sendRows(rows)
    );
  }
  bulkSend() {
    this.table.selected.selected$
      .pipe(first(), takeUntil(this.destroyed))
      .subscribe((selected) =>
        this.confirmRows(
          selected.filter((row) => canSendEmail(row.state)),
          {
            title: 'Envoyer la sélection',
            confirmLabel: 'Envoyer',
            message:
              'Envoyer les e-mails sélectionnés sur cette page dont l’état autorise l’envoi ?',
            class: 'primary',
          },
          (rows) => this.sendRows(rows)
        )
      );
  }
  private sendRows(rows: Email[]) {
    this.busyAction = true;
    this.notifications
      .showForm(EmailSendingPopupComponent, {
        width: '640px',
        maxWidth: 'calc(100vw - 2rem)',
        data: { emails: rows },
      })
      .afterClosed()
      .pipe(
        takeUntil(this.destroyed),
        finalize(() => (this.busyAction = false))
      )
      .subscribe(() => this.refresh());
  }
  private resetOne(row: Email) {
    if (!canResetEmail(row.state)) return;
    this.confirmRows(
      [row],
      {
        title: 'Autoriser un renvoi',
        confirmLabel: 'Autoriser le renvoi',
        message:
          row.state === 'UNKNOWN'
            ? `Le résultat de l’envoi à ${row.to} est incertain. Vérifie d’abord sa réception pour éviter un doublon. Après vérification, un nouvel envoi est-il nécessaire ?`
            : `Ce message à ${row.to} a déjà été envoyé. Un nouvel envoi est-il nécessaire ?`,
        class: 'primary',
      },
      (rows) => {
        this.busyAction = true;
        this.api
          .emailSetError(rows[0].id!)
          .pipe(
            takeUntil(this.destroyed),
            finalize(() => {
              this.busyAction = false;
              this.refresh();
            })
          )
          .subscribe({
            next: () =>
              this.notifications.showDialog({
                title: 'Renvoi autorisé',
                message: 'Tu peux maintenant renvoyer ce message.',
                level: NotificationDialogLevel.Info,
              }),
            error: this.api.handleError(
              'Impossible de modifier l’état de l’e-mail'
            ),
          });
      }
    );
  }
  private loadDetails<T>(
    row: Email,
    request: Observable<T>,
    show: (result: T) => void
  ) {
    if (!this.isUsable(row) || this.previewingId) return;
    this.previewingId = row.id!;
    request
      .pipe(
        takeUntil(this.scopeChanged),
        takeUntil(this.destroyed),
        finalize(() => (this.previewingId = null))
      )
      .subscribe({
        next: show,
        error: this.api.handleError(
          'Impossible de charger le détail de l’e-mail'
        ),
      });
  }
  show(row: Email) {
    this.loadDetails(row, this.api.getEmail(row.id!), (email) => {
      if (email)
        this.notifications.show(EmailTemplatePreviewComponent, {
          width: '960px',
          maxWidth: 'calc(100vw - 2rem)',
          data: { subject: email.subject, message: email.message },
        });
    });
  }
  showError(row: Email) {
    this.loadDetails(row, this.api.getEmailStatus(row.id!), (status) => {
      this.notifications.showDialog({
        title: 'Détails de l’e-mail',
        message:
          status?.error ||
          'Aucune erreur d’envoi enregistrée. Vérifie le modèle avec l’aperçu.',
        level: status?.error
          ? NotificationDialogLevel.Error
          : NotificationDialogLevel.Info,
      });
    });
  }
}
