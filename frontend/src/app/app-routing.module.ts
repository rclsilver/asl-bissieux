import { NgModule } from "@angular/core";
import { ExtraOptions, RouterModule, Routes } from "@angular/router";
import { isAuthenticated } from "./core/guards/auth.guard";

const routes: Routes = [
  {
    path: "tour",
    canActivate: [isAuthenticated],
    loadComponent: () => import("./tour/tour.component").then(m => m.TourComponent),
  },
  {
    path: "",
    pathMatch: "full",
    redirectTo: "/dashboard",
  },
  {
    path: "dashboard",
    loadChildren: () =>
      import("./dashboard/dashboard.module").then((m) => m.DashboardModule),
  },
  {
    path: "budgets",
    loadChildren: () =>
      import("./budgets/budgets.module").then((mod) => mod.BudgetsModule),
  },
  {
    path: "units",
    loadChildren: () =>
      import("./units/units.module").then((mod) => mod.UnitsModule),
  },
  {
    path: "members",
    loadChildren: () =>
      import("./members/members.module").then((mod) => mod.MembersModule),
  },
  {
    path: "emails",
    loadChildren: () =>
      import("./emails/emails.module").then((mod) => mod.EmailsModule),
  },
  {
    path: "users",
    loadChildren: () =>
      import("./users/users.module").then((mod) => mod.UsersModule),
  },
  {
    path: "mailing-lists",
    loadChildren: () =>
      import("./mailings/mailings.module").then((m) => m.MailingsModule),
  },
];

const config: ExtraOptions = {
  useHash: true,
  // Guards wait for the session check; bootstrap must still resolve the URL.
  initialNavigation: "enabledNonBlocking",
};

@NgModule({
  imports: [RouterModule.forRoot(routes, config)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
