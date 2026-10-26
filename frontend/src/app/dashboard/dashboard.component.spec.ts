import { provideZoneChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from "@angular/router";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { BehaviorSubject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "@angular/router";
import { AuthService } from "../core/services/auth.service";
import { APISchemas } from "../core/api/openapi";
import { DashboardModule } from "./dashboard.module";
import { DashboardComponent } from "./dashboard.component";

const unit = {
  id: "unit",
  number: 12,
  address: "Adresse fictive",
  members: [
    { id: "one", first_name: "Alice", last_name: "Fixture" },
    { id: "two", first_name: "Bob", last_name: "Fixture" },
  ],
};
function finance(id: string, label: string) {
  return {
    budget: { id, label, draft: false, amount: 100 },
    recovery: {
      called: 100,
      paid: 120,
      remaining: 0,
      surplus: 20,
      refunded: 0,
      rate: 100,
      lots: 1,
      settled: 1,
      partial: 0,
      unpaid: 0,
      overpaid: 1,
    },
    cotisations: [
      {
        id: "call-" + id,
        unit,
        amount: 100,
        paid: 120,
        remaining: -20,
        payment_state: 4,
      },
    ],
    years: [2025, 2026],
    months: Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      payments: i === 0 ? 120 : 0,
      refunds: 0,
      net: i === 0 ? 120 : 0,
      cumulative: 120,
    })),
  };
}

describe("Dashboard scopes and recovery", () => {
  let http: HttpTestingController;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let admin: BehaviorSubject<boolean>;
  beforeEach(async () => {
    params = new BehaviorSubject(
      convertToParamMap({ budget: "a", year: "2026" }),
    );
    admin = new BehaviorSubject(false);
    await TestBed.configureTestingModule({
      imports: [DashboardModule, NoopAnimationsModule],
      providers: [
        provideZoneChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { queryParamMap: params } },
        { provide: AuthService, useValue: { administrator$: admin } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function setup(
    emailFailure = false,
    choices?: APISchemas["ModelsBudgetResult"][],
    budgetFailure = false,
  ) {
    const f = TestBed.createComponent(DashboardComponent);
    f.detectChanges();
    const budgets = http.expectOne("/api/budget");
    if (budgetFailure)
      budgets.flush({}, { status: 503, statusText: "Unavailable" });
    else
      budgets.flush(
        choices ?? [
          { id: "a", label: "Premier", draft: false },
          { id: "b", label: "Deuxième", draft: false },
        ],
      );
    http
      .expectOne("/api/unit")
      .flush([unit, { id: "empty", number: 13, members: [] }]);
    http
      .expectOne("/api/dashboard/directory")
      .flush({ missing_email: 1, no_member: 1, invalid_shares: 0 });
    const email = http.expectOne("/api/dashboard/emails");
    if (emailFailure)
      email.flush({}, { status: 503, statusText: "Unavailable" });
    else
      email.flush({
        counts: {
          total: 0,
          waiting: 0,
          sending: 0,
          successful: 0,
          error: 0,
          unknown: 0,
        },
        recent: [],
        campaigns: 0,
      });
    return f;
  }
  const choices = [
    {
      id: "newest",
      label: "Budget sans année",
      draft: true,
      created_at: "2026-10-20T12:00:00Z",
    },
    {
      id: "older",
      label: "Exercice 2030",
      draft: false,
      created_at: "2025-10-20T12:00:00Z",
    },
  ];
  it("defaults to the most recently created budget regardless of array order, label or draft state", () => {
    params.next(convertToParamMap({ year: "2026" }));
    const f = setup(false, choices);
    http
      .expectOne("/api/budget/newest/dashboard?year=2026")
      .flush(finance("newest", "Budget par défaut"));
    f.detectChanges();
    expect(f.componentInstance.budgetId).toBe("newest");
    expect(f.nativeElement.textContent).toContain("Budget par défaut");
    expect(f.nativeElement.querySelector("app-interactive-map")).not.toBeNull();
    expect(f.nativeElement.querySelector("app-collections-chart")).toBeNull();
    expect(f.nativeElement.querySelector("#collections-title")).toBeNull();
    expect(f.nativeElement.querySelector("table")).toBeNull();
    expect(f.nativeElement.querySelector(".comparison-section").open).toBe(
      false,
    );
    http.expectNone("/api/budget/older/dashboard?year=2026");
  });
  it("keeps an explicit URL selection, including deliberately choosing no budget", () => {
    params.next(convertToParamMap({ budget: "older", year: "2026" }));
    const f = setup(false, choices);
    http
      .expectOne("/api/budget/older/dashboard?year=2026")
      .flush(finance("older", "Choix explicite"));
    params.next(convertToParamMap({ budget: "", year: "2026" }));
    f.detectChanges();
    expect(f.componentInstance.budgetId).toBe("");
    http.expectNone("/api/budget/newest/dashboard?year=2026");
  });
  it("leaves an empty catalogue unselected and defaults only after a successful retry", () => {
    params.next(convertToParamMap({ year: "2026" }));
    const f = setup(false, [], true);
    expect(f.componentInstance.budgetId).toBe("");
    http.expectNone((r) => r.url.startsWith("/api/budget/"));
    f.componentInstance.retry("budgets");
    http.expectOne("/api/budget").flush([]);
    expect(f.componentInstance.budgetId).toBe("");
    f.componentInstance.retry("budgets");
    http.expectOne("/api/budget").flush(choices);
    http
      .expectOne("/api/budget/newest/dashboard?year=2026")
      .flush(finance("newest", "Chargé"));
    expect(f.componentInstance.budgetId).toBe("newest");
  });
  it("does not replace a missing explicit budget with an unrelated latest budget", () => {
    params.next(convertToParamMap({ budget: "missing", year: "2026" }));
    const f = setup(false, choices);
    http
      .expectOne("/api/budget/missing/dashboard?year=2026")
      .flush({}, { status: 404, statusText: "Not Found" });
    f.detectChanges();
    expect(f.componentInstance.budgetId).toBe("missing");
    expect(f.nativeElement.textContent).toContain(
      "Impossible de charger ce budget",
    );
    http.expectNone("/api/budget/newest/dashboard?year=2026");
  });
  it("defers the no-call diagnostic until the lot catalogue has loaded", () => {
    params.next(convertToParamMap({ budget: "a", year: "2026", lot: "13" }));
    const f = TestBed.createComponent(DashboardComponent);
    f.detectChanges();
    http
      .expectOne("/api/budget")
      .flush([{ id: "a", label: "Budget", draft: false }]);
    http.expectOne("/api/dashboard/directory").flush({});
    http.expectOne("/api/dashboard/emails").flush({ counts: {}, recent: [] });
    http
      .expectOne("/api/budget/a/dashboard?year=2026")
      .flush(finance("a", "Budget"));
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain(
      "Chargement de la situation du lot",
    );
    expect(f.nativeElement.textContent).not.toContain(
      "ne correspond pas à un lot actif",
    );
    http
      .expectOne("/api/unit")
      .flush([{ id: "empty", number: 13, members: [] }]);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain(
      "Aucune cotisation pour ce lot",
    );
  });
  it("cancels old budgets and years immediately while keeping global modules independent", () => {
    const f = setup(true);
    const old = http.expectOne("/api/budget/a/dashboard?year=2026");
    params.next(convertToParamMap({ budget: "b", year: "2026" }));
    expect(old.cancelled).toBe(true);
    const next = http.expectOne("/api/budget/b/dashboard?year=2026");
    params.next(convertToParamMap({ budget: "b", year: "2025" }));
    expect(next.cancelled).toBe(true);
    http
      .expectOne("/api/budget/b/dashboard?year=2025")
      .flush(finance("b", "Budget actuel"));
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain("Budget actuel");
    expect(f.nativeElement.textContent).toContain(
      "La synthèse des e-mails est indisponible",
    );
    expect(() => old.flush(finance("a", "Ancien budget"))).toThrow();
    expect(f.nativeElement.textContent).not.toContain("Ancien budget");
    f.componentInstance.retry("emails");
    http.expectOne("/api/dashboard/emails").flush({
      counts: {
        total: 0,
        waiting: 0,
        sending: 0,
        successful: 0,
        error: 0,
        unknown: 0,
      },
      recent: [],
      campaigns: 0,
    });
    http.expectNone("/api/auth/access-requests/summary");
  });
  it("requests and displays access counts only while the user is an administrator", () => {
    const f = setup();
    http
      .expectOne("/api/budget/a/dashboard?year=2026")
      .flush(finance("a", "Budget"));
    http.expectNone("/api/auth/access-requests/summary");
    admin.next(true);
    const request = http.expectOne("/api/auth/access-requests/summary");
    admin.next(false);
    expect(request.cancelled).toBe(true);
    f.detectChanges();
    expect(f.nativeElement.textContent).not.toContain(
      "Demandes d’accès — administration",
    );
    admin.next(true);
    http.expectOne("/api/auth/access-requests/summary").flush({ pending: 2 });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain("2 demandes en attente");
  });
  it("loads only the selected lot payments, retries an error and distinguishes no call from no payment", () => {
    const f = setup();
    http
      .expectOne("/api/budget/a/dashboard?year=2026")
      .flush(finance("a", "Budget"));
    params.next(convertToParamMap({ budget: "a", year: "2026", lot: "12" }));
    http
      .expectOne("/api/budget/a/cotisations/call-a/payments")
      .flush({}, { status: 503, statusText: "Unavailable" });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain("Alice Fixture");
    expect(f.nativeElement.textContent).toContain("Bob Fixture");
    expect(f.nativeElement.textContent).toContain("Trop-perçu à rembourser");
    f.componentInstance.retry("payments");
    http.expectOne("/api/budget/a/cotisations/call-a/payments").flush([
      {
        id: "p",
        date: "2026-01-31T23:30:00Z",
        amount: 120,
        comment: "Paiement fictif",
      },
    ]);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain("01/02/2026");
    params.next(convertToParamMap({ budget: "a", year: "2026", lot: "13" }));
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain(
      "Aucune cotisation pour ce lot",
    );
    expect(f.nativeElement.textContent).not.toContain("Paiement fictif");
  });
  it("keeps a draft provisional and treats a zero reference without a misleading percentage", () => {
    const f = setup();
    http.expectOne("/api/budget/a/dashboard?year=2026").flush({
      budget: {
        id: "a",
        label: "Brouillon",
        draft: true,
        amount: 120,
        preview: {
          amount: 120,
          total_shares: 4,
          months: 12,
          annual_per_share: 30,
          monthly_per_share: 2.5,
          ready: true,
        },
      },
      recovery: { called: 0, rate: null },
      cotisations: [],
      months: [],
      years: [2026],
    });
    params.next(
      convertToParamMap({ budget: "a", year: "2026", reference: "b" }),
    );
    http
      .expectOne("/api/budget/b")
      .flush({ id: "b", label: "Référence nulle", draft: false, amount: 0 });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain("Prévisions uniquement");
    expect(f.nativeElement.textContent).toContain(
      "le pourcentage n’est pas calculé",
    );
    expect(f.nativeElement.textContent).toContain("n’ont pas été historisées");
    expect(f.nativeElement.querySelector("app-interactive-map")).toBeNull();
    expect(f.componentInstance.comparisonDifference).toBe(120);
    expect(f.componentInstance.comparisonPercent).toBeNull();
  });
  it("searches members from the payment map without changing financial colors or reloading the budget", () => {
    const f = setup();
    http
      .expectOne("/api/budget/a/dashboard?year=2026")
      .flush(finance("a", "Budget"));
    params.next(
      convertToParamMap({ budget: "a", year: "2026", search: "Álîce" }),
    );
    f.detectChanges();
    expect(f.componentInstance.matchingMapUnits.map((u) => u.number)).toEqual([
      12,
    ]);
    const polygon = f.nativeElement.querySelector("#unit-12");
    expect(polygon.classList.contains("unit-highlighted")).toBe(true);
    expect(polygon.classList.contains("dashboard-overpaid")).toBe(true);
    expect(f.nativeElement.textContent).toContain("1 lot trouvé");
    http.expectNone("/api/budget/a/dashboard?year=2026");
    params.next(
      convertToParamMap({ budget: "a", year: "2026", search: "lot 1" }),
    );
    f.detectChanges();
    expect(f.componentInstance.matchingMapUnits).toEqual([]);
    expect(f.nativeElement.textContent).toContain("0 lot trouvé");
    expect(polygon.classList.contains("dashboard-overpaid")).toBe(true);
    expect(polygon.classList.contains("unit-highlighted")).toBe(false);
  });
  it("searches lots without calls and merges the input into the URL without a new history entry per keystroke", () => {
    const f = setup();
    http
      .expectOne("/api/budget/a/dashboard?year=2026")
      .flush(finance("a", "Budget"));
    params.next(
      convertToParamMap({ budget: "a", year: "2026", search: "lot 13" }),
    );
    f.detectChanges();
    expect(f.componentInstance.highlightedMapUnits).toEqual([13]);
    expect(
      f.nativeElement
        .querySelector("#unit-13")
        .classList.contains("dashboard-no-call"),
    ).toBe(true);
    const navigate = vi
      .spyOn(TestBed.inject(Router), "navigate")
      .mockResolvedValue(true);
    const input = f.nativeElement.querySelector(
      ".map-search input",
    ) as HTMLInputElement;
    input.value = "Bob";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { search: "Bob", lot: null },
        queryParamsHandling: "merge",
        replaceUrl: true,
      }),
    );
  });
});
