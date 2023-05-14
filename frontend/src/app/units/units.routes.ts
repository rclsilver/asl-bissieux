import { Routes, RouterModule } from '@angular/router';
import { isAuthenticated } from '../core/guards/auth.guard';
import { ListUnitsComponent } from './components/list-units/list-units.component';

let routes: Routes = [
  {
    path: '',
    canActivate: [isAuthenticated],
    children: [
      {
        path: '',
        pathMatch: 'full',
        component: ListUnitsComponent,
      },
    ],
  },
];

export let UnitsRouterModule = RouterModule.forChild(routes);
