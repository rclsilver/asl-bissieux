import { Routes, RouterModule } from '@angular/router';
import { isAuthenticated } from '../core/guards/auth.guard';
import { ListMembersComponent } from './components/list-members/list-members.component';

let routes: Routes = [
  {
    path: '',
    canActivate: [isAuthenticated],
    children: [
      {
        path: '',
        pathMatch: 'full',
        component: ListMembersComponent,
      },
    ],
  },
];

export let MembersRouterModule = RouterModule.forChild(routes);
