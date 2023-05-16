import { Component, Inject, ViewChild } from '@angular/core';
import { MatCheckbox } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export type ConfirmDialogData = {
  class?: 'primary' | 'warn';
  title: string;
  message: string;
  force?: boolean;
};

@Component({
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.scss'],
})
export class ConfirmDialogComponent {
  @ViewChild('force', { static: false }) force?: MatCheckbox;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData,
    private dialog: MatDialogRef<ConfirmDialogComponent>
  ) {}

  get class() {
    return this.data.class ?? 'info';
  }

  cancel(): void {
    if (this.data.force) {
      this.dialog.close([false, false]);
    } else {
      this.dialog.close(false);
    }
  }

  confirm(): void {
    if (this.data.force) {
      this.dialog.close([true, this.force!.checked]);
    } else {
      this.dialog.close(true);
    }
  }
}
