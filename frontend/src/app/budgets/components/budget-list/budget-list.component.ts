import { Component, OnInit, inject } from '@angular/core';
import { APISchemas } from 'src/app/core/api/openapi';
import { AuthService } from 'src/app/core/services/auth.service';
import { BudgetDataSource } from '../../datasources/budget.datasource';
import { Column } from 'src/app/shared/models/column.model';
import { combineLatest, map, of, switchMap } from 'rxjs';
import { NotificationsService } from 'src/app/shared/services/notifications.service';
import { ApiService } from 'src/app/core/services/api.service';
import { MatDialog } from '@angular/material/dialog';
import { BudgetFormComponent } from '../budget-form/budget-form.component';
import { CustomRowAction } from 'src/app/shared/components/crud-table/crud-table.component';
import { NotificationDialogLevel } from 'src/app/shared/components/notification-dialog/notification-dialog.component';
import { BudgetEmailFormComponent } from '../budget-email-form/budget-email-form.component';

@Component({
  selector: 'app-budget-list',
  templateUrl: './budget-list.component.html',
  styleUrls: ['./budget-list.component.scss'],
})
export class BudgetListComponent {
  private readonly _api = inject(ApiService);
  private readonly _auth = inject(AuthService);
  private readonly _dialog = inject(MatDialog);
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
            'Publish the budget',
            'Publish',
            (row) =>
              this._notifications
                .showConfirm({
                  title: 'Publish the budget',
                  message: `Confirm publishing the budget ${row.label}? Further modifications will be disabled.`,
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
                          message: `The budget ${row.label} has been published`,
                          level: NotificationDialogLevel.Info,
                        });
                      },
                      error: (e) => {
                        this._notifications.showDialog({
                          title: 'Error',
                          message: `Unable to delete the budget: ${e}`,
                          level: NotificationDialogLevel.Error,
                        });
                      },
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
            'Send e-mail',
            'E-mail',
            (row) =>
              this._dialog.open(BudgetEmailFormComponent, {
                width: '800px',
                data: {
                  budget: row,
                },
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
      label: 'Label',
      routeTo: (v) => {
        return `/budgets/${v.id}`;
      },
      canSort: true,
      canFilter: true,
    }),
    new Column('draft', {
      label: 'Draft',
      canSort: true,
    }),
    new Column('amount', {
      label: 'Amount',
      render: (v) => `${v} €`,
      canSort: true,
    }),
    new Column('paid', {
      label: 'Paid',
      render: (v) => `${v} €`,
      canSort: true,
    }),
  ];
  readonly datasource = new BudgetDataSource();

  readonly canCreate$ = this._auth.allowed$('budget.CreateBudget');

  refresh() {
    this.datasource.load();
  }

  canEdit(budget: APISchemas['ModelsBudgetResult']) {
    return this._auth.administrator$.pipe(
      switchMap((administrator) => {
        if (administrator) {
          return of(true);
        }

        if (!budget.draft) {
          return of(false);
        }

        return this._auth.allowed$('budget.UpdateBudget');
      })
    );
  }

  canDelete(budget: APISchemas['ModelsBudgetResult']) {
    return this._auth.administrator$.pipe(
      switchMap((administrator) => {
        if (administrator) {
          return of(true);
        }

        if (!budget.draft) {
          return of(false);
        }

        return this._auth.allowed$('budget.DeleteBudget');
      })
    );
  }

  edit(budget?: APISchemas['ModelsBudgetResult']) {
    this._dialog
      .open(BudgetFormComponent, {
        width: '480px',
        data: {
          budget,
        },
      })
      .afterClosed()
      .subscribe((result: boolean) => {
        if (result) {
          this.refresh();
        }
      });
  }

  delete(budget: APISchemas['ModelsBudgetResult']) {
    this._notifications
      .showConfirm({
        title: 'Delete a budget',
        message: `Are you sure to delete the budget ${budget.label}?`,
        class: 'warn',
      })
      .afterClosed()
      .subscribe((confirm: boolean) => {
        if (confirm) {
          this._api.deleteBudget(budget.id!).subscribe({
            next: () => {
              this.refresh();
              this._notifications.showDialog({
                title: 'Info',
                message: `The budget ${budget.label} has been deleted`,
                level: NotificationDialogLevel.Info,
              });
            },
            error: (e) => {
              this._notifications.showDialog({
                title: 'Error',
                message: `Unable to delete the budget: ${e}`,
                level: NotificationDialogLevel.Error,
              });
            },
          });
        }
      });
  }
}
