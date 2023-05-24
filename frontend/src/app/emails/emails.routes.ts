import { Routes, RouterModule } from '@angular/router';
import { isAuthenticated } from '../core/guards/auth.guard';
import { EmailListComponent } from './components/email-list/email-list.component';

let routes: Routes = [
  {
    path: '',
    canActivate: [isAuthenticated],
    children: [
      {
        path: '',
        pathMatch: 'full',
        component: EmailListComponent,
      },
    ],
  },
];

export let EmailsRouterModule = RouterModule.forChild(routes);
