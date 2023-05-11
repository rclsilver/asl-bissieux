import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ListBudgetsComponent } from './list-budgets/list-budgets.component';
import { ViewBudgetComponent } from './view-budget/view-budget.component';
import { BudgetsRouterModule } from './budgets.routes';

@NgModule({
  declarations: [ListBudgetsComponent, ViewBudgetComponent],
  imports: [CommonModule, BudgetsRouterModule],
})
export class BudgetsModule {}
