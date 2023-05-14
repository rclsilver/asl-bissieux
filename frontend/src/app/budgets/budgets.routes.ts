import { Routes, RouterModule } from '@angular/router';
import { ListBudgetsComponent } from './components/list-budgets/list-budgets.component';
import { isAuthenticated } from '../core/guards/auth.guard';
import { ViewBudgetComponent } from './components/view-budget/view-budget.component';

let routes: Routes = [
  {
    path: '',
    canActivate: [isAuthenticated],
    children: [
      {
        path: '',
        pathMatch: 'full',
        component: ListBudgetsComponent,
      },
      {
        path: ':id',
        component: ViewBudgetComponent,
      },
    ],
  },
];

export let BudgetsRouterModule = RouterModule.forChild(routes);
