import { Routes, RouterModule } from '@angular/router';
import { isAuthenticated } from '../core/guards/auth.guard';
import { EmailListComponent } from './components/email-list/email-list.component';
import { EmailsComponent } from './emails.component';
import { EmailTemplateListComponent } from './components/email-template-list/email-template-list.component';

let routes: Routes = [
  {
    path: '',
    component: EmailsComponent,
    canActivate: [isAuthenticated],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'sent',
      },
      {
        path: 'sent',
        component: EmailListComponent,
      },
      {
        path: 'templates',
        component: EmailTemplateListComponent,
      },
    ],
  },
];

export let EmailsRouterModule = RouterModule.forChild(routes);
