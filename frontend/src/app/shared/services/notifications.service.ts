import { Component, Injectable, inject } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import {
  ConfirmDialogData,
  ConfirmDialogComponent,
} from '../components/confirm-dialog/confirm-dialog.component';
import {
  NotificationDialogComponent,
  NotificationDialogData,
} from '../components/notification-dialog/notification-dialog.component';
import { ComponentType } from '@angular/cdk/portal';

@Injectable({
  providedIn: 'root',
})
export class NotificationsService {
  private readonly _dialog = inject(MatDialog);

  show<T, D = any>(dialog: ComponentType<T>, params: D) {
    return this._dialog.open<T, D>(
      dialog,
      Object.assign({ disableClose: true, width: '100%' }, params ?? {})
    );
  }

  showDialog(params: NotificationDialogData) {
    return this._dialog.open<
      NotificationDialogComponent,
      NotificationDialogData
    >(NotificationDialogComponent, {
      data: params,
      disableClose: true,
    });
  }

  showConfirm(params: ConfirmDialogData) {
    return this._dialog.open<
      ConfirmDialogComponent,
      ConfirmDialogData,
      boolean
    >(ConfirmDialogComponent, {
      data: params,
      disableClose: true,
    });
  }

  showForm<T, D = any>(form: ComponentType<T>, params: D) {
    return this._dialog.open<T, D, boolean>(
      form,
      Object.assign({ disableClose: true, width: '100%' }, params ?? {})
    );
  }
}
