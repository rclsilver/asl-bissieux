import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { APISchemas } from 'src/app/core/api/openapi';

@Component({
  selector: 'app-email-view-dialog',
  templateUrl: './email-view-dialog.component.html',
  styleUrls: ['./email-view-dialog.component.scss'],
})
export class EmailViewDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA)
    public readonly data: {
      email: APISchemas['ModelsEmail'];
    },
    private readonly _dialogRef: MatDialogRef<EmailViewDialogComponent>
  ) {}

  close() {
    this._dialogRef.close(false);
  }
}
