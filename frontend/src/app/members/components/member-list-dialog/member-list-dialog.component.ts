import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { APISchemas } from 'src/app/core/api/openapi';

@Component({
  selector: 'app-member-list-dialog',
  templateUrl: './member-list-dialog.component.html',
  styleUrls: ['./member-list-dialog.component.scss'],
})
export class MemberListDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA)
    public readonly data: {
      unit?: APISchemas['ModelsUnit'];
    },
    private readonly _dialogRef: MatDialogRef<MemberListDialogComponent>
  ) {}

  close() {
    this._dialogRef.close(false);
  }
}
