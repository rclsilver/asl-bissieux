import {
  Component,
  OnDestroy,
  OnInit,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { Column, CustomRenderColumn } from 'src/app/shared/models/column.model';
import { NotificationsService } from 'src/app/shared/services/notifications.service';
import { CustomRowAction } from 'src/app/shared/components/crud-table/crud-table.component';
import { UserDataSource } from '../../datasources/user.datasource';
import { UserFormComponent } from '../user-form/user-form.component';
import { accessLabels, accessState, providerLabel } from '../../user-labels';

type User = APISchemas['AuthUser'];
type Decision = 'approve' | 'reject' | 'disable' | 'reactivate';

@Component({
  selector: 'app-user-list',
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class UserListComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();
  readonly administrator$ = this.auth.administrator$;
  readonly accessLabels = accessLabels;
  readonly datasource = new UserDataSource();
  status = '';
  busy = false;
  message = '';
  error = '';
  readonly columns = [
    new Column('username', { label: 'Compte', canSort: true, canFilter: true }),
    new CustomRenderColumn<User, string>('provider', providerLabel, {
      label: 'Fournisseur',
      canFilter: true,
    }),
    new CustomRenderColumn<User, string>(
      'access',
      (u) => accessLabels[accessState(u)] ?? 'Accès désactivé',
      { label: 'État de l’accès', canSort: true }
    ),
    new Column('admin', {
      label: 'Rôle',
      render: (v) => (v ? 'Administrateur' : 'Autorisations particulières'),
      canSort: true,
    }),
    new Column<string[] | undefined>('actions', {
      label: 'Droits particuliers',
      render: (v) => String((v ?? []).length),
    }),
  ];
  readonly rowActions = [
    new CustomRowAction<User>(
      'check_circle',
      'Activer l’accès',
      'Activer l’accès',
      (u) => this.decide(u, 'approve'),
      (u) => accessState(u) === 'pending',
      () => this.busy
    ),
    new CustomRowAction<User>(
      'block',
      'Refuser l’accès',
      'Refuser l’accès',
      (u) => this.decide(u, 'reject'),
      (u) => accessState(u) === 'pending',
      () => this.busy
    ),
    new CustomRowAction<User>(
      'block',
      'Désactiver l’accès',
      'Désactiver l’accès',
      (u) => this.decide(u, 'disable'),
      (u) => accessState(u) === 'active',
      () => this.busy
    ),
    new CustomRowAction<User>(
      'refresh',
      'Réactiver l’accès',
      'Réactiver l’accès',
      (u) => this.decide(u, 'reactivate'),
      (u) => ['disabled', 'rejected'].includes(accessState(u)),
      () => this.busy
    ),
  ];
  ngOnInit() {
    this.route.queryParamMap
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        const status = params.get('status') ?? '';
        this.status = ['active', 'pending', 'rejected', 'disabled'].includes(
          status
        )
          ? status
          : '';
        this.datasource.status = this.status;
        this.refresh();
      });
  }
  filter(status: string) {
    if (!this.busy)
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { status: status || null },
        queryParamsHandling: 'merge',
      });
  }
  refresh() {
    this.datasource.load();
  }
  canEdit(_: User) {
    return this.administrator$;
  }
  edit(user?: User) {
    if (this.busy) return;
    this.notifications
      .showForm(UserFormComponent, {
        data: { user },
        maxWidth: '640px',
        width: 'calc(100vw - 2rem)',
      })
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((saved) => {
        this.refresh();
        if (saved) {
          this.message = 'Les droits ont été enregistrés.';
          this.refreshSession();
        }
      });
  }
  private refreshSession() {
    this.auth
      .refresh()
      .pipe(takeUntil(this.destroy$))
      .subscribe({ error: () => {} });
  }
  decide(user: User, decision: Decision) {
    if (this.busy || !user.id) return;
    this.busy = true;
    this.error = '';
    this.message = '';
    this.api
      .getUser(user.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (current) => {
          if (!current) {
            this.busy = false;
            return;
          }
          const expected =
            decision === 'approve' || decision === 'reject'
              ? 'pending'
              : decision === 'disable'
                ? 'active'
                : null;
          if (
            expected
              ? accessState(current) !== expected
              : !['disabled', 'rejected'].includes(accessState(current))
          ) {
            this.busy = false;
            this.error =
              'L’état du compte a changé. La liste a été actualisée.';
            this.refresh();
            return;
          }
          const label = {
            approve: 'Activer l’accès',
            reject: 'Refuser l’accès',
            disable: 'Désactiver l’accès',
            reactivate: 'Réactiver l’accès',
          }[decision];
          this.notifications
            .showConfirm({
              title: label,
              confirmLabel: label,
              message: `${label} pour ${current.username} (${providerLabel(current)}) ? ${decision === 'disable' || decision === 'reject' ? 'Les sessions de ce compte seront révoquées.' : 'L’accès sera accordé avec les droits actuellement définis.'} L’identité de connexion reste associée.`,
              class:
                decision === 'disable' || decision === 'reject'
                  ? 'warn'
                  : 'primary',
            })
            .afterClosed()
            .pipe(takeUntil(this.destroy$))
            .subscribe((confirm) => {
              if (!confirm) {
                this.busy = false;
                return;
              }
              this.api
                .updateUser(current.id!, {
                  username: current.username,
                  enabled: decision === 'approve' || decision === 'reactivate',
                  admin: current.admin,
                  actions: current.actions,
                  access_decision: decision,
                  expected_updated_at: current.updated_at,
                })
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                  next: () => {
                    this.busy = false;
                    this.message = `${label} : décision enregistrée pour ${current.username}.`;
                    this.refresh();
                    this.refreshSession();
                  },
                  error: (e) => {
                    this.busy = false;
                    this.error =
                      e.data?.message ??
                      'Impossible de modifier l’accès. Actualise la liste avant de réessayer.';
                    this.refresh();
                  },
                });
            });
        },
        error: () => {
          this.busy = false;
          this.error = 'Impossible de vérifier la fiche du compte. Réessaie.';
        },
      });
  }
  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
