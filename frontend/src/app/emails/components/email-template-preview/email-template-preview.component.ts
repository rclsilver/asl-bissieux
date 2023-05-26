import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-email-template-preview',
  templateUrl: './email-template-preview.component.html',
  styleUrls: ['./email-template-preview.component.scss'],
})
export class EmailTemplatePreviewComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA)
    public readonly data: {
      subject: string;
      message: string;
    },
    private readonly _dialogRef: MatDialogRef<EmailTemplatePreviewComponent>
  ) {}

  close() {
    this._dialogRef.close(false);
  }
}
