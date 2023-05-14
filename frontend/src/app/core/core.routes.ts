import { Routes, RouterModule } from '@angular/router';
import { HomeComponent } from './components/home/home.component';

let routes: Routes = [
  {
    path: '',
    children: [
      {
        path: '',
        pathMatch: 'full',
        component: HomeComponent,
      },
    ],
  },
];

export let CoreRouterModule = RouterModule.forChild(routes);
