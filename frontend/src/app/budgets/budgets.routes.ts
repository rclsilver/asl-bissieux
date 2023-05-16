import { Routes, RouterModule } from '@angular/router';
import { BudgetListComponent } from './components/budget-list/budget-list.component';
import { isAuthenticated } from '../core/guards/auth.guard';
import { BudgetDetailsComponent } from './components/budget-details/budget-details.component';

let routes: Routes = [
  {
    path: '',
    canActivate: [isAuthenticated],
    children: [
      {
        path: '',
        pathMatch: 'full',
        component: BudgetListComponent,
      },
      {
        path: ':id',
        component: BudgetDetailsComponent,
      },
    ],
  },
];

export let BudgetsRouterModule = RouterModule.forChild(routes);
