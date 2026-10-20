import { Component, ChangeDetectionStrategy } from "@angular/core";
import { Observable, map, shareReplay } from "rxjs";
import { BreakpointObserver, Breakpoints } from "@angular/cdk/layout";
import { AuthService } from "../../services/auth.service";

@Component({
  selector: "app-page",
  templateUrl: "./page.component.html",
  styleUrls: ["./page.component.scss"],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class PageComponent {
  readonly isHandset$ = this._breakpoints.observe(Breakpoints.Handset).pipe(
    map((result) => result.matches),
    shareReplay(),
  );

  readonly authenticated$ = this._auth.authenticated$;
  readonly user$ = this._auth.user$;
  readonly active$ = this._auth.active$;
  readonly administrator$ = this._auth.administrator$;
  readonly configuration$ = this._auth.configuration$;
  readonly loading$ = this._auth.loading$;
  readonly message$ = this._auth.message$;

  readonly links: {
    label: string;
    icon: string | null;
    path: string;
    allowed$: Observable<boolean>;
  }[] = [
    {
      label: "Budgets",
      path: "/budgets",
      icon: "euro-sign",
      allowed$: this.active$,
    },
    {
      label: "Units",
      path: "/units",
      icon: "map",
      allowed$: this.active$,
    },
    {
      label: "Members",
      path: "/members",
      icon: "users",
      allowed$: this.active$,
    },
    {
      label: "E-mails",
      path: "/emails",
      icon: "mail-bulk",
      allowed$: this.active$,
    },
    {
      label: "Users",
      path: "/users",
      icon: "key",
      allowed$: this.administrator$,
    },
  ];

  constructor(
    private _breakpoints: BreakpointObserver,
    private _auth: AuthService,
  ) {}

  ngOnInit(): void {
    this._auth.init();
  }

  logout() {
    return this._auth.logout().subscribe({ error: () => {} });
  }

  loginLabel(label?: string): string {
    const provider = label?.trim();
    return provider && provider !== "Se connecter"
      ? `Continuer avec ${provider}`
      : "Se connecter";
  }

  reloadPage() {
    window.location.reload();
  }

  login() {
    this._auth.login();
  }
}
