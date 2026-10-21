import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Subject,
  distinctUntilChanged,
  takeUntil,
  combineLatest,
  map,
} from 'rxjs';
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
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class EmailCampaignListComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();
  state = '';
  readonly states = [
    { value: 'WAITING', label: 'En attente' },
    { value: 'SENDING', label: 'En cours d’envoi' },
    { value: 'SUCCESSFUL', label: 'Envoyés (signaux d’ouverture inclus)' },
    { value: 'ERROR', label: 'En erreur' },
    { value: 'UNKNOWN', label: 'Envois à vérifier' },
  ];
  ngOnInit() {
    this.route.queryParamMap
      .pipe(
        map((p) => {
          const state = p.get('state') ?? '';
          return this.states.some((s) => s.value === state) ? state : '';
        }),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe((state) => {
        this.state = state;
        this.datasource.setState(state);
      });
  }
  filterState(state: string) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { state: state || null },
      queryParamsHandling: 'merge',
    });
  }
  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private readonly _api = inject(ApiService);
  private readonly _auth = inject(AuthService);
  private readonly _notifications = inject(NotificationsService);

  readonly columns = [
    new Column('title', {
      label: 'Titre',
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
    new Column<APISchemas['ModelsEmailCounts'] | undefined>('counts', {
      label: 'E-mails',
      render: (counts) => {
        if (!counts?.total) return 'Aucun e-mail';
        return [
          [counts.successful, counts.successful === 1 ? 'envoyé' : 'envoyés'],
          [counts.waiting, 'en attente'],
          [counts.sending, 'en cours'],
          [counts.error, 'en erreur'],
          [counts.unknown, 'à vérifier'],
        ]
          .filter(([count]) => Number(count) > 0)
          .map(([count, label]) => `${count} ${label}`)
          .join(' / ');
      },
    }),
  ];
  readonly datasource = new EmailCampaignDataSource();

  @ViewChild(CrudTableComponent, { static: true })
  table!: CrudTableComponent<APISchemas['ModelsEmailCampaignSummary']>;

  refresh() {
    this.datasource.load();
  }

  canDelete(_: APISchemas['ModelsEmailCampaignSummary']) {
    return this._auth.allowed$('email.DeleteEmailCampaign');
  }

  delete(campaign: APISchemas['ModelsEmailCampaignSummary']) {
    this._notifications
      .showConfirm({
        title: 'Supprimer une campagne',
        confirmLabel: 'Supprimer',
        message: `Supprimer la campagne « ${campaign.title} » ?`,
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
                message: `La campagne « ${campaign.title} » a été supprimée.`,
                level: NotificationDialogLevel.Info,
              });
            },
            error: this._api.handleError('Impossible de supprimer la campagne'),
          });
        }
      });
  }
}
