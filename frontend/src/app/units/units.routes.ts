import { Routes, RouterModule } from '@angular/router';
import { isAuthenticated } from '../core/guards/auth.guard';
import { UnitListComponent } from './components/unit-list/unit-list.component';

let routes: Routes = [
  {
    path: '',
    canActivate: [isAuthenticated],
    children: [
      {
        path: '',
        pathMatch: 'full',
        component: UnitListComponent,
      },
    ],
  },
];

export let UnitsRouterModule = RouterModule.forChild(routes);
