import { Routes, RouterModule } from '@angular/router';
import { ListBudgetsComponent } from './list-budgets/list-budgets.component';
import { isAuthenticated } from '../core/auth.guard';
import { ViewBudgetComponent } from './view-budget/view-budget.component';

let routes: Routes = [
  {
    path: '',
    component: ListBudgetsComponent,
    canActivate: [isAuthenticated],
    children: [
      {
        path: ':id',
        component: ViewBudgetComponent,
      },
    ],
  },
];

export let BudgetsRouterModule = RouterModule.forChild(routes);
