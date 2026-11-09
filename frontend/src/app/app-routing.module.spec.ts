import {
  Component,
  importProvidersFrom,
  inject,
  provideAppInitializer,
  provideZoneChangeDetection,
} from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { AsyncPipe } from "@angular/common";
import {
  Router,
  RouterOutlet,
  RouterLink,
  RouterLinkActive,
} from "@angular/router";
import { BehaviorSubject, firstValueFrom, filter, take } from "rxjs";
import { describe, expect, it } from "vitest";
import { AppRoutingModule } from "./app-routing.module";
import { AuthService } from "./core/services/auth.service";
import { isAuthenticated } from "./core/guards/auth.guard";

@Component({
  selector: "app-arrival-test",
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AsyncPipe],
  template: `@if (active$ | async) {
    <a
      routerLink="/dashboard"
      routerLinkActive="active"
      ariaCurrentWhenActive="page"
      >Accueil</a
    >
    <a
      routerLink="/members"
      routerLinkActive="active"
      ariaCurrentWhenActive="page"
      >Membres</a
    >
    <router-outlet />
  }`,
})
class ArrivalShell {
  readonly active$ = inject(AuthService).active$;
}
@Component({ template: "<h1>Page chargée</h1>" })
class ArrivalPage {}

describe("Application arrival", () => {
  it.each(["", "#/members?quality=missing_email"])(
    "resolves %s at bootstrap after the session check",
    async (hash) => {
      window.history.replaceState(null, "", "/" + hash);
      const host = document.createElement("app-arrival-test");
      document.body.append(host);
      const loading$ = new BehaviorSubject(true);
      const active$ = new BehaviorSubject(false);
      let router!: Router;
      // Use the production routing providers and bootstrap listener, without fetching business data.
      const app = await bootstrapApplication(ArrivalShell, {
        providers: [
          provideZoneChangeDetection(),
          importProvidersFrom(AppRoutingModule),
          {
            provide: AuthService,
            useValue: { loading$, active$, rememberReturnPath() {} },
          },
          provideAppInitializer(() => {
            inject(Router).resetConfig([
              { path: "", pathMatch: "full", redirectTo: "/dashboard" },
              {
                path: "dashboard",
                component: ArrivalPage,
                canActivate: [isAuthenticated],
              },
              {
                path: "members",
                component: ArrivalPage,
                canActivate: [isAuthenticated],
              },
            ]);
          }),
        ],
      });
      try {
        router = app.injector.get(Router);
        expect(host.textContent).not.toContain("Page chargée");
        const finished = firstValueFrom(
          router.events.pipe(
            filter(() => router.navigated),
            take(1),
          ),
        );
        active$.next(true);
        loading$.next(false);
        await finished;
        app.tick();
        expect(router.url).toBe(
          hash ? "/members?quality=missing_email" : "/dashboard",
        );
        expect(host.textContent).toContain("Page chargée");
        await new Promise<void>((resolve) => queueMicrotask(resolve));
        app.tick();
        expect(host.querySelector('[aria-current="page"]')?.textContent).toBe(
          hash ? "Membres" : "Accueil",
        );
      } finally {
        app.destroy();
        host.remove();
        window.history.replaceState(null, "", "/");
      }
    },
  );
});
