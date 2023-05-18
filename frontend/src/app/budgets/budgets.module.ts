import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../shared/shared.module';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { BudgetsRouterModule } from './budgets.routes';
import { BudgetListComponent } from './components/budget-list/budget-list.component';
import { BudgetDetailsComponent } from './components/budget-details/budget-details.component';
import { BudgetFormComponent } from './components/budget-form/budget-form.component';
import { ExpenseFormComponent } from './components/expense-form/expense-form.component';
import { PaymentListComponent } from './components/payment-list/payment-list.component';
import { PaymentFormComponent } from './components/payment-form/payment-form.component';

const material = [
  MatButtonModule,
  MatCheckboxModule,
  MatDialogModule,
  MatFormFieldModule,
  MatInputModule,
  MatProgressSpinnerModule,
  MatTabsModule,
  MatTableModule,
];

@NgModule({
  declarations: [
    BudgetListComponent,
    BudgetDetailsComponent,
    BudgetFormComponent,
    ExpenseFormComponent,
    PaymentListComponent,
    PaymentFormComponent,
  ],
  imports: [
    CommonModule,
    SharedModule,
    ReactiveFormsModule,
    ...material,
    BudgetsRouterModule,
  ],
})
export class BudgetsModule {}
