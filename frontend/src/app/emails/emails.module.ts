import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../shared/shared.module';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { EmailsRouterModule } from './emails.routes';
import { EmailsComponent } from './emails.component';
import { EmailListComponent } from './components/email-list/email-list.component';
import { EmailTemplateListComponent } from './components/email-template-list/email-template-list.component';
import { EmailTemplateFormComponent } from './components/email-template-form/email-template-form.component';
import { EmailTemplatePreviewFormComponent } from './components/email-template-preview-form/email-template-preview-form.component';
import { EmailTemplatePreviewComponent } from './components/email-template-preview/email-template-preview.component';

const material = [
  MatButtonModule,
  MatDialogModule,
  MatFormFieldModule,
  MatIconModule,
  MatInputModule,
  MatTableModule,
  MatTooltipModule,
];

@NgModule({
  declarations: [
    EmailsComponent,
    EmailListComponent,
    EmailTemplateListComponent,
    EmailTemplateFormComponent,
    EmailTemplatePreviewFormComponent,
    EmailTemplatePreviewComponent,
  ],
  imports: [
    CommonModule,
    SharedModule,
    ReactiveFormsModule,
    ...material,
    EmailsRouterModule,
  ],
})
export class EmailsModule {}
