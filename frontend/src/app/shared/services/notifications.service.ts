import { Injectable, inject } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import {
  ConfirmDialogData,
  ConfirmDialogComponent,
} from '../components/confirm-dialog/confirm-dialog.component';
import {
  NotificationDialogComponent,
  NotificationDialogData,
} from '../components/notification-dialog/notification-dialog.component';

@Injectable({
  providedIn: 'root',
})
export class NotificationsService {
  private readonly _dialog = inject(MatDialog);

  showDialog(
    params: NotificationDialogData
  ): MatDialogRef<NotificationDialogComponent> {
    return this._dialog.open(NotificationDialogComponent, {
      data: params,
      hasBackdrop: false,
    });
  }

  showConfirm(params: ConfirmDialogData): MatDialogRef<ConfirmDialogComponent> {
    return this._dialog.open(ConfirmDialogComponent, {
      data: params,
      hasBackdrop: false,
    });
  }
}
