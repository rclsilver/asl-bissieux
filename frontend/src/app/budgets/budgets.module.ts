import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ListBudgetsComponent } from './components/list-budgets/list-budgets.component';
import { ViewBudgetComponent } from './components/view-budget/view-budget.component';
import { BudgetsRouterModule } from './budgets.routes';
import { EditBudgetComponent } from './components/edit-budget/edit-budget.component';

@NgModule({
  declarations: [
    ListBudgetsComponent,
    ViewBudgetComponent,
    EditBudgetComponent,
  ],
  imports: [CommonModule, BudgetsRouterModule],
})
export class BudgetsModule {}
