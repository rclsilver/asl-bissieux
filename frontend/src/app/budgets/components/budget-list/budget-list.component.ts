import {
  Component,
  OnInit,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { APISchemas } from 'src/app/core/api/openapi';
import { AuthService } from 'src/app/core/services/auth.service';
import { BudgetDataSource } from '../../datasources/budget.datasource';
import { Column } from 'src/app/shared/models/column.model';
import { combineLatest, map, of } from 'rxjs';
import { NotificationsService } from 'src/app/shared/services/notifications.service';
import { ApiService } from 'src/app/core/services/api.service';
import { BudgetFormComponent } from '../budget-form/budget-form.component';
import { CustomRowAction } from 'src/app/shared/components/crud-table/crud-table.component';
import { NotificationDialogLevel } from 'src/app/shared/components/notification-dialog/notification-dialog.component';
import { BudgetEmailFormComponent } from '../budget-email-form/budget-email-form.component';

@Component({
  selector: 'app-budget-list',
  templateUrl: './budget-list.component.html',
  styleUrls: ['./budget-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class BudgetListComponent {
  private readonly _api = inject(ApiService);
  private readonly _auth = inject(AuthService);
  private readonly _notifications = inject(NotificationsService);

  readonly rowActions$ = combineLatest([
    this._auth.allowed$('budget.PublishBudget'),
    this._auth.allowed$('budget.SendEmail'),
  ]).pipe(
    map(([publishBudget, sendEmail]) => {
      const actions: CustomRowAction<APISchemas['ModelsBudgetResult']>[] = [];

      if (publishBudget) {
        actions.push(
          new CustomRowAction<APISchemas['ModelsBudgetResult']>(
            'cloud',
            'Publier le budget',
            'Publier',
            (row) =>
              this._notifications
                .showConfirm({
                  title: 'Publier le budget',
                  confirmLabel: 'Publier',
                  message: `Publier le budget ${row.label} ? Les dépenses et cotisations seront figées et le budget ne pourra plus être supprimé. Le libellé et les paiements resteront modifiables selon tes droits.`,
                  class: 'warn',
                })
                .afterClosed()
                .subscribe((confirm) => {
                  if (confirm) {
                    this._api.publishBudget(row.id!).subscribe({
                      next: () => {
                        this.refresh();
                        this._notifications.showDialog({
                          title: 'Info',
                          message: `Le budget « ${row.label} » a été publié.`,
                          level: NotificationDialogLevel.Info,
                        });
                      },
                      error: this._api.handleError(
                        'Impossible de publier le budget'
                      ),
                    });
                  }
                }),
            (row) => {
              return row.draft === true;
            }
          )
        );
      }

      if (sendEmail) {
        actions.push(
          new CustomRowAction<APISchemas['ModelsBudgetResult']>(
            'mail',
            'Préparer les e-mails',
            'Préparer les e-mails',
            (row) =>
              this._notifications.showForm(BudgetEmailFormComponent, {
                data: {
                  budget: row,
                },
                width: '760px',
                maxWidth: 'calc(100vw - 2rem)',
                maxHeight: 'calc(100dvh - 2rem)',
              }),
            (row) => {
              return !row.draft;
            }
          )
        );
      }

      return actions;
    })
  );

  readonly columns = [
    new Column('label', {
      label: 'Libellé',
      routeTo: (v) => {
        return `/budgets/${v.id}`;
      },
      canSort: true,
      canFilter: true,
    }),
    new Column('draft', {
      label: 'Brouillon',
      canSort: true,
    }),
    new Column('amount', {
      label: 'Montant',
      render: (v) =>
        new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: 'EUR',
        }).format(v),
      canSort: true,
    }),
    new Column('paid', {
      label: 'Réglé',
      render: (v) =>
        new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: 'EUR',
        }).format(v),
      canSort: true,
    }),
  ];
  readonly datasource = new BudgetDataSource();

  readonly canCreate$ = this._auth.allowed$('budget.CreateBudget');

  refresh() {
    this.datasource.load();
  }

  canEdit(_: APISchemas['ModelsBudgetResult']) {
    return this._auth.allowed$('budget.UpdateBudget');
  }

  canDelete(budget: APISchemas['ModelsBudgetResult']) {
    return budget.draft
      ? this._auth.allowed$('budget.DeleteBudget')
      : of(false);
  }

  edit(budget?: APISchemas['ModelsBudgetResult']) {
    this._notifications
      .showForm(BudgetFormComponent, {
        data: {
          budget,
        },
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.refresh();
        }
      });
  }

  delete(budget: APISchemas['ModelsBudgetResult']) {
    this._notifications
      .showConfirm({
        title: 'Supprimer un budget',
        confirmLabel: 'Supprimer',
        message: `Supprimer le budget « ${budget.label} » ?`,
        class: 'warn',
      })
      .afterClosed()
      .subscribe((confirm) => {
        if (confirm) {
          this._api.deleteBudget(budget.id!).subscribe({
            next: () => {
              this.refresh();
              this._notifications.showDialog({
                title: 'Info',
                message: `Le budget « ${budget.label} » a été supprimé.`,
                level: NotificationDialogLevel.Info,
              });
            },
            error: this._api.handleError('Impossible de supprimer le budget'),
          });
        }
      });
  }
}
