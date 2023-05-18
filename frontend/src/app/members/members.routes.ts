import { Routes, RouterModule } from '@angular/router';
import { isAuthenticated } from '../core/guards/auth.guard';
import { MemberListComponent } from './components/member-list/member-list.component';

let routes: Routes = [
  {
    path: '',
    canActivate: [isAuthenticated],
    children: [
      {
        path: '',
        pathMatch: 'full',
        component: MemberListComponent,
      },
    ],
  },
];

export let MembersRouterModule = RouterModule.forChild(routes);
