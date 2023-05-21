import { NgModule } from '@angular/core';
import { ExtraOptions, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: '/budgets',
  },
  {
    path: 'budgets',
    loadChildren: () =>
      import('./budgets/budgets.module').then((mod) => mod.BudgetsModule),
  },
  {
    path: 'units',
    loadChildren: () =>
      import('./units/units.module').then((mod) => mod.UnitsModule),
  },
  {
    path: 'members',
    loadChildren: () =>
      import('./members/members.module').then((mod) => mod.MembersModule),
  },
  {
    path: 'users',
    loadChildren: () =>
      import('./users/users.module').then((mod) => mod.UsersModule),
  },
];

const config: ExtraOptions = {
  useHash: true,
  initialNavigation: 'disabled',
};

@NgModule({
  imports: [RouterModule.forRoot(routes, config)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
