import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  BehaviorSubject,
  of,
  tap,
  Subject,
  catchError,
  combineLatest,
  map,
  shareReplay,
  switchMap,
  take,
  takeUntil,
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
import {
  COTISATION_DIALOG_OPTIONS,
  PaymentListComponent,
} from '../payment-list/payment-list.component';
import { EmptyDataSource } from 'src/app/shared/datasources/empty.datasource';
import { PaymentState, paymentState, paymentClass } from '../../payment-state';

@Component({
  selector: 'app-budget-details',
  templateUrl: './budget-details.component.html',
  styleUrls: ['./budget-details.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class BudgetDetailsComponent implements OnInit, OnDestroy {
  budgetLoading = true;
  budgetError = false;
  coverage = '';
  cotisationFilter = '';
  readonly coverageLabels: Record<string, string> = {
    received: 'Avec encaissement net',
    remaining: 'Reste à encaisser',
    settled: 'Lots à jour',
    partial: 'Partiellement réglés',
    unpaid: 'Sans paiement',
    overpaid: 'Trop-perçus',
  };
  private readonly _destroy$ = new Subject<void>();
  private readonly _refresh$ = new BehaviorSubject<void>(undefined);
  readonly STATE_OK = PaymentState.Done;
  readonly STATE_DOING = PaymentState.Doing;
  readonly STATE_KO = PaymentState.Waiting;
  readonly STATE_OVERPAID = PaymentState.Overpaid;

  formatAmount(amount: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  }

  formatRate(amount: number): string {
    return (
      new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
      }).format(amount) + ' €'
    );
  }

  private readonly _auth = inject(AuthService);
  private readonly _api = inject(ApiService);
  private readonly _route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  filterCoverage(coverage: string) {
    this.router.navigate([], {
      relativeTo: this._route,
      queryParams: { coverage: coverage || null, cotisation: null },
      queryParamsHandling: 'merge',
    });
  }
  private readonly _notifications = inject(NotificationsService);

  private _budget$ = new BehaviorSubject<
    APISchemas['ModelsBudgetResult'] | null
  >(null);
  readonly budget$ = this._budget$.asObservable();

  // expenses
  readonly expensesColumns = [
    new Column('label', {
      label: 'Libellé',
      canSort: true,
      canFilter: true,
    }),
    new Column('amount', {
      label: 'Montant',
      render: (v) => this.formatAmount(v),
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
    this._auth.allowed$('budget.CreateExpense'),
  ]).pipe(map(([budget, allowed]) => !!budget?.draft && allowed));

  canEditExpense(_: APISchemas['ModelsExpense']) {
    return combineLatest([
      this.budget$,
      this._auth.allowed$('budget.UpdateExpense'),
    ]).pipe(map(([budget, allowed]) => !!budget?.draft && allowed));
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
    return combineLatest([
      this.budget$,
      this._auth.allowed$('budget.DeleteExpense'),
    ]).pipe(map(([budget, allowed]) => !!budget?.draft && allowed));
  }

  deleteExpense(expense: APISchemas['ModelsExpense']) {
    const budget = this._budget$.value;
    if (!budget?.id || !budget.draft) return;
    this._notifications
      .showConfirm({
        title: 'Supprimer une dépense',
        confirmLabel: 'Supprimer',
        message: `Supprimer la dépense ${expense.label} ?`,
        class: 'warn',
      })
      .afterClosed()
      .subscribe((confirm) => {
        if (
          confirm &&
          this._budget$.value?.id === budget.id &&
          this._budget$.value?.draft
        ) {
          this._api.deleteExpense(budget.id!, expense.id!).subscribe({
            next: () => {
              this.refreshExpenses();
              this._notifications.showDialog({
                title: 'Info',
                message: `La dépense ${expense.label} a été supprimée`,
                level: NotificationDialogLevel.Info,
              });
            },
            error: this._api.handleError('Impossible de supprimer la dépense'),
          });
        }
      });
  }

  refreshExpenses() {
    this.refreshBudget();
  }

  // cotisations
  readonly cotisationsColumns = [
    new CustomRenderColumn<APISchemas['ModelsCotisationResult'], number>(
      'state',
      paymentState,
      {
        label: '',
        canSort: true,
      }
    ),
    new Column('unit.number', {
      label: 'Lot',
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
        label: 'Membres',
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
      label: 'Adresse',
      canFilter: true,
    }),
    new Column('unit.share', {
      label: 'Parts',
      canSort: true,
    }),
    new Column('amount', {
      label: 'Montant',
      render: (v) => this.formatAmount(v),
      canSort: true,
    }),
    new Column('paid', {
      label: 'Réglé',
      render: (v) => this.formatAmount(v),
      canSort: true,
    }),
    new CustomRenderColumn<APISchemas['ModelsCotisationResult'], number>(
      'remaining',
      (row) => row.remaining ?? (row?.amount ?? 0) - (row?.paid ?? 0),
      {
        label: 'Solde',
        render: (v) => this.formatAmount(v),
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
    switchMap((ds) =>
      ds instanceof CotisationDataSource ? ds.allResults$ : ds.results$
    ),
    map(
      (cotisations) =>
        cotisations
          .map((cotisation) => {
            const id = cotisation.unit?.number ?? 0;
            const cls = paymentClass(cotisation);

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
      const actions: CustomRowAction<APISchemas['ModelsCotisationResult']>[] =
        [];

      if (!budget?.draft) {
        actions.push(
          new CustomRowAction<APISchemas['ModelsCotisationResult']>(
            'list',
            'Consulter la cotisation',
            'Consulter la cotisation',
            (row) =>
              this._notifications
                .showForm(PaymentListComponent, {
                  ...COTISATION_DIALOG_OPTIONS,
                  data: {
                    budgetId: this._budget$.value?.id,
                    cotisationId: row.id,
                    unitNumber: row.unit?.number,
                  },
                })
                .afterClosed()
                .subscribe(() => {
                  this.refreshBudget();
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
    combineLatest([this._route.queryParamMap, this.cotisations$])
      .pipe(takeUntil(this._destroy$))
      .subscribe(([p, source]) => {
        const scope = p.get('coverage') ?? '';
        this.coverage = Object.hasOwn(this.coverageLabels, scope) ? scope : '';
        this.cotisationFilter = p.get('cotisation') ?? '';
        source?.setScope(this.coverage, this.cotisationFilter);
      });
    combineLatest([this._route.paramMap, this._refresh$])
      .pipe(
        tap(() => {
          this.budgetLoading = true;
          this.budgetError = false;
          this._budget$.next(null);
        }),
        switchMap(([params]) =>
          this._api.getBudget(params.get('id')!).pipe(
            catchError(() => {
              this.budgetError = true;
              return of(null);
            })
          )
        ),
        takeUntil(this._destroy$)
      )
      .subscribe((budget) => {
        this.budgetLoading = false;
        this._budget$.next(budget);
      });
  }

  @HostListener('window:focus')
  refreshBudget() {
    this._refresh$.next();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }
}
