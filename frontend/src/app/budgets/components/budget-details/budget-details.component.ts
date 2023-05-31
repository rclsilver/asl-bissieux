import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  BehaviorSubject,
  combineLatest,
  map,
  of,
  shareReplay,
  switchMap,
  take,
} from 'rxjs';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { ExpenseDataSource } from '../../datasources/expense.datasource';
import { Column, CustomRenderColumn } from 'src/app/shared/models/column.model';
import { ExpenseFormComponent } from '../expense-form/expense-form.component';
import { NotificationsService } from 'src/app/shared/services/notifications.service';
import { NotificationDialogLevel } from 'src/app/shared/components/notification-dialog/notification-dialog.component';
import { CotisationDataSource } from '../../datasources/cotisation.datasource';
import { CustomRowAction } from 'src/app/shared/components/crud-table/crud-table.component';
import { PaymentListComponent } from '../payment-list/payment-list.component';
import { N } from '@angular/cdk/keycodes';
import { EmptyDataSource } from 'src/app/shared/datasources/empty.datasource';

@Component({
  selector: 'app-budget-details',
  templateUrl: './budget-details.component.html',
  styleUrls: ['./budget-details.component.scss'],
})
export class BudgetDetailsComponent implements OnInit {
  readonly STATE_OK = 1;
  readonly STATE_DOING = 2;
  readonly STATE_KO = 3;

  private readonly _auth = inject(AuthService);
  private readonly _api = inject(ApiService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _notifications = inject(NotificationsService);

  private _budget$ = new BehaviorSubject<
    APISchemas['ModelsBudgetResult'] | null
  >(null);
  readonly budget$ = this._budget$.asObservable();

  // expenses
  readonly expensesColumns = [
    new Column('label', {
      label: 'Label',
      canSort: true,
      canFilter: true,
    }),
    new Column('amount', {
      label: 'Amount',
      render: (v) => `${v} €`,
      canSort: true,
    }),
  ];
  readonly expenses$ = this.budget$.pipe(
    map((budget) =>
      budget?.id !== undefined
        ? new ExpenseDataSource(this._api, budget.id)
        : null
    ),
    shareReplay(1)
  );
  readonly canCreateExpense$ = combineLatest([
    this.budget$,
    this._auth.administrator$,
    this._auth.allowed$('budget.CreateExpense'),
  ]).pipe(
    map(([budget, administrator, allowed]) => {
      if (administrator) {
        return true;
      }

      if (!budget?.draft) {
        return false;
      }

      return allowed;
    })
  );

  canEditExpense(_: APISchemas['ModelsExpense']) {
    return combineLatest([this.budget$, this._auth.administrator$]).pipe(
      switchMap(([budget, administrator]) => {
        if (administrator) {
          return of(true);
        }

        if (!budget?.draft) {
          return of(false);
        }

        return this._auth.allowed$('budget.EditExpense');
      })
    );
  }

  editExpense(expense?: APISchemas['ModelsExpense']) {
    this._notifications
      .showForm(ExpenseFormComponent, {
        data: {
          budgetId: this._budget$.value?.id,
          expense,
        },
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.refreshExpenses();
        }
      });
  }

  canDeleteExpense(_: APISchemas['ModelsExpense']) {
    return combineLatest([this.budget$, this._auth.administrator$]).pipe(
      switchMap(([budget, administrator]) => {
        if (administrator) {
          return of(true);
        }

        if (!budget?.draft) {
          return of(false);
        }

        return this._auth.allowed$('budget.DeleteExpense');
      })
    );
  }

  deleteExpense(expense: APISchemas['ModelsExpense']) {
    this._notifications
      .showConfirm({
        title: 'Delete an expense',
        message: `Are you sure to delete the expense ${expense.label}?`,
        class: 'warn',
      })
      .afterClosed()
      .subscribe((confirm) => {
        if (confirm) {
          this._api
            .deleteExpense(this._budget$.value?.id!, expense.id!)
            .subscribe({
              next: () => {
                this.refreshExpenses();
                this._notifications.showDialog({
                  title: 'Info',
                  message: `The expense ${expense.label} has been deleted`,
                  level: NotificationDialogLevel.Info,
                });
              },
              error: this._api.handleError('Unable to delete the expense'),
            });
        }
      });
  }

  refreshExpenses() {
    return this.expenses$.pipe(take(1)).subscribe((ds) => {
      if (ds) {
        ds.load();
      }
    });
  }

  // cotisations
  readonly cotisationsColumns = [
    new CustomRenderColumn<APISchemas['ModelsCotisationResult'], number>(
      'state',
      (cotisation) => {
        const amount = cotisation?.amount ?? 0;
        const paid = cotisation?.paid ?? 0;
        const remaining = amount - paid;

        if (!remaining) {
          return this.STATE_OK;
        } else if (paid >= amount / 2) {
          return this.STATE_DOING;
        } else {
          return this.STATE_KO;
        }
      },
      {
        label: '',
        canSort: true,
      }
    ),
    new Column('unit.number', {
      label: 'Unit',
      canSort: true,
      defaultSort: true,
      canFilter: true,
    }),
    new CustomRenderColumn<
      APISchemas['ModelsCotisationResult'],
      { first_name: string; last_name: string }[]
    >(
      'members',
      (row) =>
        (row.unit?.members ?? []).map((member) => ({
          first_name: member.first_name!,
          last_name: member.last_name!,
        })),
      {
        label: 'Members',
        canSort: true,
        canFilter: true,
        filterFunc: (members, pattern) => {
          if (!pattern) {
            return true;
          }

          pattern = pattern.toLocaleLowerCase();

          for (let member of members) {
            if (member.first_name.toLowerCase().indexOf(pattern) !== -1) {
              return true;
            }

            if (member.last_name.toLowerCase().indexOf(pattern) !== -1) {
              return true;
            }
          }

          return false;
        },
        render: (v) =>
          v
            .map((member) => `${member.first_name} ${member.last_name}`)
            .join(', '),
        sortFunc: (a, b) => {
          const aMinLastName = a.map((m) => m.last_name).sort()[0];
          const bMinLastName = b.map((m) => m.last_name).sort()[0];

          if (aMinLastName === bMinLastName) {
            return 0;
          } else if (aMinLastName < bMinLastName) {
            return 1;
          } else {
            return -1;
          }
        },
      }
    ),
    new Column('unit.address', {
      label: 'Address',
      canFilter: true,
    }),
    new Column('unit.share', {
      label: 'Share',
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
    new CustomRenderColumn<APISchemas['ModelsCotisationResult'], number>(
      'remaining',
      (row) => (row?.amount ?? 0) - (row?.paid ?? 0),
      {
        label: 'Remaining',
        render: (v) => `${v} €`,
        canSort: true,
      }
    ),
  ];
  readonly cotisations$ = this.budget$.pipe(
    map((budget) =>
      budget?.id !== undefined && !budget.draft
        ? new CotisationDataSource(this._api, budget.id)
        : null
    ),
    shareReplay(1)
  );

  /*
  readonly unitClasses$ = this.budget$.pipe(
    switchMap((budget) => this._api.listCotisations(budget?.id!)),
    */
  readonly unitClasses$ = this.cotisations$.pipe(
    map((ds) =>
      ds ? ds : new EmptyDataSource<APISchemas['ModelsCotisationResult']>()
    ),
    switchMap((ds) => ds.results$),
    map(
      (cotisations) =>
        cotisations
          .map((cotisation) => {
            const id = cotisation.unit?.number ?? 0;
            const cls =
              cotisation.amount == cotisation.paid
                ? 'payment-done'
                : cotisation.paid ?? 0 >= (cotisation.amount ?? 0) / 2
                ? 'payment-doing'
                : 'payment-waiting';

            return {
              unit: id,
              class: cls,
            };
          })
          .reduce((res, val) => {
            return Object.assign(res, {
              [val.unit]: val.class,
            });
          }, {}) as { [unit: number]: string }
    )
  );

  readonly cotisationsRowActions$ = this._budget$.pipe(
    map((budget) => {
      const actions: CustomRowAction<APISchemas['ModelsBudgetResult']>[] = [];

      if (!budget?.draft) {
        actions.push(
          new CustomRowAction<APISchemas['ModelsBudgetResult']>(
            'list',
            'Manage the payments',
            'Manage payments',
            (row) =>
              this._notifications
                .showForm(PaymentListComponent, {
                  data: {
                    budgetId: this._budget$.value?.id,
                    cotisationId: row.id,
                  },
                })
                .afterClosed()
                .subscribe(() => {
                  this.refreshCotisations();
                })
          )
        );
      }

      return actions;
    })
  );

  refreshCotisations() {
    return this.cotisations$.pipe(take(1)).subscribe((ds) => {
      if (ds) {
        ds.load();
      }
    });
  }

  ngOnInit(): void {
    this.loadBudget();
  }

  loadBudget() {
    this._route.paramMap
      .pipe(switchMap((params) => this._api.getBudget(params.get('id')!)))
      .subscribe((budget) => this._budget$.next(budget));
  }
}
