import { Component, Inject, OnInit, inject } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogRef,
} from '@angular/material/dialog';
import { BehaviorSubject, map, shareReplay, take } from 'rxjs';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { PaymentDataSource } from '../../datasources/payment.datasource';
import { Column, DateRender } from 'src/app/shared/models/column.model';
import { PaymentFormComponent } from '../payment-form/payment-form.component';
import { NotificationsService } from 'src/app/shared/services/notifications.service';
import { NotificationDialogLevel } from 'src/app/shared/components/notification-dialog/notification-dialog.component';

@Component({
  selector: 'app-payment-list',
  templateUrl: './payment-list.component.html',
  styleUrls: ['./payment-list.component.scss'],
})
export class PaymentListComponent implements OnInit {
  private readonly _auth = inject(AuthService);
  private readonly _api = inject(ApiService);
  private readonly _dialog = inject(MatDialog);
  private readonly _notifications = inject(NotificationsService);

  readonly columns = [
    new Column('date', {
      label: 'Date',
      render: DateRender(),
    }),
    new Column('comment', {
      label: 'Comment',
    }),
    new Column('amount', {
      label: 'Amount',
      render: (v) => `${v} €`,
    }),
    new Column('user.username', {
      label: 'Created by',
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
    this._dialog
      .open(PaymentFormComponent, {
        width: '480px',
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
      .subscribe((result: boolean) => {
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
        title: 'Delete a payment',
        message: 'Are you sure to delete the payment?',
        class: 'warn',
      })
      .afterClosed()
      .subscribe((confirm: boolean) => {
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
                  message: 'The payment has been deleted',
                  level: NotificationDialogLevel.Info,
                });
              },
              error: (e) => {
                this._notifications.showDialog({
                  title: 'Error',
                  message: `Unable to delete the payment: ${e}`,
                  level: NotificationDialogLevel.Error,
                });
              },
            });
        }
      });
  }

  constructor(
    @Inject(MAT_DIALOG_DATA)
    private readonly _data: {
      budgetId: string;
      cotisationId: string;
    },
    private readonly _dialogRef: MatDialogRef<PaymentListComponent>
  ) {}

  ngOnInit(): void {
    this.loadBudget();
  }

  loadBudget() {
    this._api
      .getBudget(this._data.budgetId)
      .subscribe((budget) => this._budget$.next(budget));
  }

  refresh() {
    this.payments$.pipe(take(1)).subscribe((ds) => {
      if (ds) {
        ds.load();
      }
    });
  }
}
