import { Routes, RouterModule } from '@angular/router';
import { isAuthenticated } from '../core/guards/auth.guard';
import { EmailsComponent } from './emails.component';
import { EmailCampaignListComponent } from './components/email-campaign-list/email-campaign-list.component';
import { EmailTemplateListComponent } from './components/email-template-list/email-template-list.component';
import { EmailListComponent } from './components/email-list/email-list.component';

let routes: Routes = [
  {
    path: '',
    component: EmailsComponent,
    canActivate: [isAuthenticated],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'campaigns',
      },
      {
        path: 'campaigns',
        component: EmailCampaignListComponent,
      },
      {
        path: 'templates',
        component: EmailTemplateListComponent,
      },
    ],
  },
  {
    path: 'campaigns/:id',
    canActivate: [isAuthenticated],
    component: EmailListComponent,
  },
];

export let EmailsRouterModule = RouterModule.forChild(routes);
