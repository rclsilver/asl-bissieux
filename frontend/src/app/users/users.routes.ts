import { Routes, RouterModule } from '@angular/router';
import { isAdministrator } from '../core/guards/auth.guard';
import { UserListComponent } from './components/user-list/user-list.component';

let routes: Routes = [
  {
    path: '',
    canActivate: [isAdministrator],
    children: [
      {
        path: '',
        pathMatch: 'full',
        component: UserListComponent,
      },
    ],
  },
];

export let UsersRouterModule = RouterModule.forChild(routes);
