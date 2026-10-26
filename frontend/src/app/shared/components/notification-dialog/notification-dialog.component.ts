import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

export enum NotificationDialogLevel {
  Info = 'info',
  Error = 'error',
}

export type NotificationDialogData = {
  title: string;
  message: string;
  level: NotificationDialogLevel;
  detail?: any;
};

@Component({
  templateUrl: './notification-dialog.component.html',
  styleUrls: ['./notification-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class NotificationDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: NotificationDialogData,
    private dialog: MatDialogRef<NotificationDialogComponent>
  ) {}

  close(): void {
    this.dialog.close();
  }
}
