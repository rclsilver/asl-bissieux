import {
  Component,
  ViewChild,
  Inject,
  OnInit,
  inject,
  ChangeDetectionStrategy,
  DestroyRef,
} from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { BehaviorSubject, map, shareReplay, take } from 'rxjs';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { PaymentDataSource } from '../../datasources/payment.datasource';
import { Column, DateRender } from 'src/app/shared/models/column.model';
import { FinancialHistoryComponent } from '../financial-history/financial-history.component';
import { PaymentFormComponent } from '../payment-form/payment-form.component';
import { NotificationsService } from 'src/app/shared/services/notifications.service';
import { NotificationDialogLevel } from 'src/app/shared/components/notification-dialog/notification-dialog.component';

export const COTISATION_DIALOG_OPTIONS = {
  width: 'min(76rem, calc(100vw - 2rem))',
  height: 'min(56rem, calc(100dvh - 2rem))',
  maxWidth: '100vw',
  maxHeight: '100dvh',
  panelClass: 'cotisation-dialog',
  autoFocus: 'first-heading',
};

@Component({
  selector: 'app-payment-list',
  templateUrl: './payment-list.component.html',
  styleUrls: ['./payment-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class PaymentListComponent implements OnInit {
  private readonly _auth = inject(AuthService);
  private readonly _api = inject(ApiService);
  private readonly _notifications = inject(NotificationsService);
  private readonly breakpoints = inject(BreakpointObserver);
  private readonly destroyed = inject(DestroyRef);

  @ViewChild(FinancialHistoryComponent) history?: FinancialHistoryComponent;
  loadError = false;
  view: 'situation' | 'payments' = 'situation';
  readonly data = this._data;

  setView(view: 'situation' | 'payments') {
    if (!this.history?.busy) this.view = view;
  }

  readonly columns = [
    new Column('date', {
      label: 'Date',
      render: DateRender(),
    }),
    new Column('comment', {
      label: 'Commentaire',
    }),
    new Column('amount', {
      label: 'Montant',
      render: (v) =>
        new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: 'EUR',
        }).format(v),
    }),
    new Column('user.username', {
      label: 'Enregistré par',
    }),
  ];

  private _budget$ = new BehaviorSubject<
    APISchemas['ModelsBudgetResult'] | null
  >(null);
  readonly budget$ = this._budget$.asObservable();

  readonly payments$ = this.budget$.pipe(
    map((budget) =>
      budget?.id !== undefined
        ? new PaymentDataSource(this._api, budget.id, this._data.cotisationId)
        : null
    ),
    shareReplay(1)
  );

  readonly canCreate$ = this._auth.allowed$('budget.CreatePayment');

  close() {
    this._dialogRef.close();
  }

  canEdit(_: APISchemas['ModelsPayment']) {
    return this._auth.allowed$('budget.UpdatePayment');
  }

  edit(payment?: APISchemas['ModelsPayment']) {
    this._notifications
      .showForm(PaymentFormComponent, {
        width: '36rem',
        maxWidth: 'calc(100vw - 2rem)',
        maxHeight: 'calc(100dvh - 2rem)',
        data: {
          budget: {
            id: this._data.budgetId,
          },
          cotisation: {
            id: this._data.cotisationId,
          },
          payment,
        },
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.refresh();
        }
      });
  }

  canDelete(_: APISchemas['ModelsPayment']) {
    return this._auth.allowed$('budget.DeletePayment');
  }

  delete(payment: APISchemas['ModelsPayment']) {
    this._notifications
      .showConfirm({
        title: 'Supprimer un paiement',
        confirmLabel: 'Supprimer',
        message: 'Supprimer ce paiement ?',
        class: 'warn',
      })
      .afterClosed()
      .subscribe((confirm) => {
        if (confirm) {
          this._api
            .deletePayment(
              this._data.budgetId,
              this._data.cotisationId,
              payment.id!
            )
            .subscribe({
              next: () => {
                this.refresh();
                this._notifications.showDialog({
                  title: 'Info',
                  message: 'Le paiement a été supprimé.',
                  level: NotificationDialogLevel.Info,
                });
              },
              error: this._api.handleError(
                'Impossible de supprimer le paiement'
              ),
            });
        }
      });
  }

  constructor(
    @Inject(MAT_DIALOG_DATA)
    private readonly _data: {
      budgetId: string;
      cotisationId: string;
      unitNumber?: number;
    },
    private readonly _dialogRef: MatDialogRef<PaymentListComponent>
  ) {}

  ngOnInit(): void {
    this.breakpoints
      .observe('(max-width: 600px)')
      .pipe(takeUntilDestroyed(this.destroyed))
      .subscribe(({ matches }) =>
        this._dialogRef.updateSize(
          matches ? '100vw' : COTISATION_DIALOG_OPTIONS.width,
          matches ? '100dvh' : COTISATION_DIALOG_OPTIONS.height
        )
      );
    this.loadBudget();
  }

  loadBudget() {
    this._api.getBudget(this._data.budgetId).subscribe({
      next: (budget) => {
        this.loadError = false;
        this._budget$.next(budget);
      },
      error: () => {
        this.loadError = true;
      },
    });
  }

  refresh() {
    this.history?.load();
    this.payments$.pipe(take(1)).subscribe((ds) => {
      if (ds) {
        ds.load();
      }
    });
  }
}
