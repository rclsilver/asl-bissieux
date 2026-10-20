import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../shared/shared.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { BudgetsRouterModule } from './budgets.routes';
import { BudgetListComponent } from './components/budget-list/budget-list.component';
import { BudgetDetailsComponent } from './components/budget-details/budget-details.component';
import { BudgetFormComponent } from './components/budget-form/budget-form.component';
import { ExpenseFormComponent } from './components/expense-form/expense-form.component';
import { PaymentListComponent } from './components/payment-list/payment-list.component';
import { PaymentFormComponent } from './components/payment-form/payment-form.component';
import { BudgetEmailFormComponent } from './components/budget-email-form/budget-email-form.component';
import { TemplateDataEditorComponent } from '../shared/components/template-data-editor/template-data-editor.component';

import { FinancialHistoryComponent } from './components/financial-history/financial-history.component';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
const material = [
  MatMenuModule,
  MatIconModule,
  MatTooltipModule,
  MatAutocompleteModule,
  MatButtonModule,
  MatCheckboxModule,
  MatDialogModule,
  MatFormFieldModule,
  MatInputModule,
  MatProgressSpinnerModule,
  MatSelectModule,
  MatTabsModule,
  MatTableModule,
  MatSlideToggleModule,
];

@NgModule({
  declarations: [
    BudgetListComponent,
    BudgetDetailsComponent,
    BudgetFormComponent,
    ExpenseFormComponent,
    PaymentListComponent,
    FinancialHistoryComponent,
    PaymentFormComponent,
    BudgetEmailFormComponent,
  ],
  imports: [
    CommonModule,
    TemplateDataEditorComponent,
    SharedModule,
    FormsModule,
    ReactiveFormsModule,
    ...material,
    BudgetsRouterModule,
  ],
})
export class BudgetsModule {}
