import { Routes, RouterModule } from '@angular/router';
import { isAdministrator } from '../core/guards/auth.guard';
import { ListUsersComponent } from './components/list-users/list-users.component';

let routes: Routes = [
  {
    path: '',
    canActivate: [isAdministrator],
    children: [
      {
        path: '',
        pathMatch: 'full',
        component: ListUsersComponent,
      },
    ],
  },
];

export let UsersRouterModule = RouterModule.forChild(routes);
