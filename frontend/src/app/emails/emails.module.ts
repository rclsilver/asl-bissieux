import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../shared/shared.module';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { EmailsRouterModule } from './emails.routes';
import { EmailListComponent } from './components/email-list/email-list.component';
import { EmailViewDialogComponent } from './components/email-view-dialog/email-view-dialog.component';

const material = [
  MatButtonModule,
  MatDialogModule,
  MatIconModule,
  MatTableModule,
  MatTooltipModule,
];

@NgModule({
  declarations: [EmailListComponent, EmailViewDialogComponent],
  imports: [
    CommonModule,
    SharedModule,
    ReactiveFormsModule,
    ...material,
    EmailsRouterModule,
  ],
})
export class EmailsModule {}
