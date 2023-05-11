import { Routes, RouterModule } from '@angular/router';
import { isAdministrator } from '../core/auth.guard';
import { ListUsersComponent } from './list-users/list-users.component';
import { ViewUserComponent } from './view-user/view-user.component';

let routes: Routes = [
  {
    path: '',
    component: ListUsersComponent,
    canActivate: [isAdministrator],
    children: [
      {
        path: ':id',
        component: ViewUserComponent,
      },
    ],
  },
];

export let UsersRouterModule = RouterModule.forChild(routes);
