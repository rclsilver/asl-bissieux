import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
} from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import {
  BehaviorSubject,
  Observable,
  Subject,
  catchError,
  combineLatest,
  distinctUntilChanged,
  map,
  of,
  shareReplay,
  scan,
  startWith,
  switchMap,
  takeUntil,
  tap,
} from "rxjs";
import { APISchemas } from "../core/api/openapi";
import { ApiService } from "../core/services/api.service";
import { AuthService } from "../core/services/auth.service";
import { paymentState, PaymentState } from "../budgets/payment-state";
import { memberMatches, unitMatches } from "../members/member-directory";

type Remote<T> = { loading: boolean; error: boolean; value: T | null };
const empty = <T>(): Remote<T> => ({
  loading: false,
  error: false,
  value: null,
});
const loading = <T>(): Remote<T> => ({
  loading: true,
  error: false,
  value: null,
});
const success = <T>(value: T | null): Remote<T> => ({
  loading: false,
  error: false,
  value,
});
const failure = <T>(): Remote<T> => ({
  loading: false,
  error: true,
  value: null,
});
const currentParisYear = () =>
  Number(
    new Intl.DateTimeFormat("en", {
      year: "numeric",
      timeZone: "Europe/Paris",
    }).format(new Date()),
  );
type Finance = APISchemas["ModelsBudgetDashboard"];

@Component({
  selector: "app-dashboard",
  standalone: false,
  templateUrl: "./dashboard.component.html",
  styleUrls: ["./dashboard.component.scss"],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();
  private readonly financeData$ = new BehaviorSubject<Remote<Finance>>(empty());
  private readonly reloadFinance$ = new Subject<void>();
  private readonly reloadReference$ = new Subject<void>();
  private readonly reloadBudgets$ = new Subject<void>();
  private readonly reloadUnits$ = new Subject<void>();
  private readonly reloadDirectory$ = new Subject<void>();
  private readonly reloadEmails$ = new Subject<void>();
  private readonly reloadAccess$ = new Subject<void>();
  private readonly reloadPayments$ = new Subject<void>();
  private readonly budgetChoices$ = new BehaviorSubject<
    APISchemas["ModelsBudgetResult"][]
  >([]);
  private readonly selection$ = combineLatest([
    this.route.queryParamMap,
    this.budgetChoices$,
  ]).pipe(
    map(([p, budgets]) => {
      const rawYear = p.get("year");
      const year =
        rawYear && /^\d{1,4}$/.test(rawYear) && Number(rawYear) > 0
          ? Number(rawYear)
          : currentParisYear();
      const rawLot = p.get("lot");
      return {
        budget: p.has("budget")
          ? (p.get("budget") ?? "")
          : this.latestBudgetId(budgets),
        reference: p.get("reference") ?? "",
        year,
        search: p.get("search") ?? "",
        lot:
          rawLot && /^\d+$/.test(rawLot) && Number.isSafeInteger(Number(rawLot))
            ? Number(rawLot)
            : null,
      };
    }),
    tap((s) => {
      this.budgetId = s.budget;
      this.referenceId = s.reference;
      this.year = s.year;
      this.selectedLot = s.lot;
      this.mapSearch = s.search;
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
  budgets = loading<APISchemas["ModelsBudgetResult"][]>();
  units = loading<APISchemas["ModelsUnit"][]>();
  finance = empty<Finance>();
  reference = empty<APISchemas["ModelsBudgetResult"]>();
  directory = loading<APISchemas["ModelsDirectoryQuality"]>();
  emails = loading<APISchemas["ModelsEmailDashboard"]>();
  access = empty<APISchemas["AuthAccessRequestSummary"]>();
  payments = empty<APISchemas["ModelsPayment"][]>();
  budgetId = "";
  referenceId = "";
  year = currentParisYear();
  selectedLot: number | null = null;
  mapSearch = "";
  administrator = false;
  ngOnInit() {
    this.bind(
      this.reloadBudgets$,
      () => this.api.listBudgets(),
      (v) => {
        this.budgets = v;
        if (v.value) this.budgetChoices$.next(v.value);
      },
    );
    this.bind(
      this.reloadUnits$,
      () => this.api.listUnits(),
      (v) => (this.units = v),
    );
    this.bind(
      this.reloadDirectory$,
      () => this.api.getDirectoryQuality(),
      (v) => (this.directory = v),
    );
    this.bind(
      this.reloadEmails$,
      () => this.api.getEmailDashboard(),
      (v) => (this.emails = v),
    );
    combineLatest([
      this.selection$.pipe(
        map((s) => ({ budget: s.budget, year: s.year })),
        distinctUntilChanged(
          (a, b) => a.budget === b.budget && a.year === b.year,
        ),
      ),
      this.reloadFinance$.pipe(startWith(undefined)),
    ])
      .pipe(
        tap(([s]) => this.financeData$.next(s.budget ? loading() : empty())),
        switchMap(([s]) =>
          s.budget
            ? this.api.getBudgetDashboard(s.budget, s.year).pipe(
                map((v) => success(v)),
                catchError(() => of(failure<Finance>())),
              )
            : of(empty<Finance>()),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe((v) => this.financeData$.next(v));
    this.financeData$
      .pipe(takeUntil(this.destroy$))
      .subscribe((v) => (this.finance = v));
    combineLatest([
      this.selection$.pipe(
        map((s) => ({ budget: s.budget, reference: s.reference })),
        distinctUntilChanged(
          (a, b) => a.budget === b.budget && a.reference === b.reference,
        ),
      ),
      this.reloadReference$.pipe(startWith(undefined)),
    ])
      .pipe(
        tap(
          ([s]) =>
            (this.reference =
              s.reference && s.reference !== s.budget ? loading() : empty()),
        ),
        switchMap(([s]) =>
          s.reference && s.reference !== s.budget
            ? this.api.getBudget(s.reference).pipe(
                map((v) => success(v)),
                catchError(() =>
                  of(failure<APISchemas["ModelsBudgetResult"]>()),
                ),
              )
            : of(empty<APISchemas["ModelsBudgetResult"]>()),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe((v) => (this.reference = v));
    this.auth.administrator$
      .pipe(
        distinctUntilChanged(),
        tap((admin) => {
          this.administrator = admin;
          this.access = empty();
        }),
        switchMap((admin) =>
          admin
            ? this.reloadAccess$.pipe(
                startWith(undefined),
                tap(() => (this.access = loading())),
                switchMap(() =>
                  this.api.getPendingAccessRequests().pipe(
                    map((v) => success(v)),
                    catchError(() =>
                      of(failure<APISchemas["AuthAccessRequestSummary"]>()),
                    ),
                  ),
                ),
              )
            : of(empty<APISchemas["AuthAccessRequestSummary"]>()),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe((v) => (this.access = v));
    combineLatest([
      this.selection$,
      this.financeData$,
      this.reloadPayments$.pipe(
        scan((n) => n + 1, 0),
        startWith(0),
      ),
    ])
      .pipe(
        map(([s, f, revision]) => ({
          revision,
          budget: s.budget,
          id:
            f.value?.cotisations?.find((c) => c.unit?.number === s.lot)?.id ??
            "",
        })),
        distinctUntilChanged(
          (a, b) =>
            a.budget === b.budget && a.id === b.id && a.revision === b.revision,
        ),
        tap((s) => (this.payments = s.id ? loading() : empty())),
        switchMap((s) =>
          s.id
            ? this.api.listPayments(s.budget, s.id).pipe(
                map((v) => success(v)),
                catchError(() => of(failure<APISchemas["ModelsPayment"][]>())),
              )
            : of(empty<APISchemas["ModelsPayment"][]>()),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe((v) => (this.payments = v));
  }
  private bind<T>(
    reload: Subject<void>,
    fetch: () => Observable<T | null>,
    set: (v: Remote<T>) => void,
  ) {
    reload
      .pipe(
        startWith(undefined),
        tap(() => set(loading())),
        switchMap(() =>
          fetch().pipe(
            map((v) => success(v)),
            catchError(() => of(failure<T>())),
          ),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe(set);
  }
  refresh() {
    this.reloadBudgets$.next();
    this.reloadFinance$.next();
    this.reloadReference$.next();
    this.reloadUnits$.next();
    this.reloadDirectory$.next();
    this.reloadEmails$.next();
    this.reloadAccess$.next();
  }
  retry(
    scope:
      | "budgets"
      | "finance"
      | "reference"
      | "units"
      | "directory"
      | "emails"
      | "access"
      | "payments",
  ) {
    ({
      budgets: this.reloadBudgets$,
      finance: this.reloadFinance$,
      reference: this.reloadReference$,
      units: this.reloadUnits$,
      directory: this.reloadDirectory$,
      emails: this.reloadEmails$,
      access: this.reloadAccess$,
      payments: this.reloadPayments$,
    })[scope].next();
  }
  private latestBudgetId(budgets: APISchemas["ModelsBudgetResult"][]) {
    return (
      budgets
        .filter(
          (budget) =>
            budget.id && Number.isFinite(Date.parse(budget.created_at ?? "")),
        )
        .sort(
          (a, b) =>
            Date.parse(b.created_at!) - Date.parse(a.created_at!) ||
            a.id!.localeCompare(b.id!),
        )[0]?.id ?? ""
    );
  }
  selectBudget(id: string) {
    this.navigate({ budget: id, reference: null, lot: null });
  }
  selectReference(id: string) {
    this.navigate({ reference: id || null });
  }
  selectLot(lot: number | null) {
    this.navigate({ lot });
  }
  searchMap(query: string) {
    this.mapSearch = query;
    this.navigate({ search: query.trim() ? query : null, lot: null }, true);
  }
  get matchingMapUnits() {
    if (!this.mapSearch.trim()) return [];
    return (this.units.value ?? []).filter(
      (unit) =>
        unitMatches(unit, this.mapSearch) ||
        (unit.members ?? []).some((member) =>
          memberMatches(member, this.mapSearch),
        ),
    );
  }
  get highlightedMapUnits() {
    return this.matchingMapUnits.flatMap((unit) =>
      unit.number === undefined ? [] : [unit.number],
    );
  }
  private navigate(
    queryParams: Record<string, string | number | null>,
    replaceUrl = false,
  ) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: "merge",
      replaceUrl,
    });
  }
  money(value?: number | null) {
    return value == null
      ? "—"
      : new Intl.NumberFormat("fr-FR", {
          style: "currency",
          currency: "EUR",
        }).format(value);
  }
  rate(value?: number | null) {
    return value == null
      ? "—"
      : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(
          value,
        ) + " %";
  }
  perShare(value?: number | null) {
    return value == null
      ? "—"
      : new Intl.NumberFormat("fr-FR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 6,
        }).format(value) + " €";
  }
  get selectedCotisation() {
    return this.finance.value?.cotisations?.find(
      (c) => c.unit?.number === this.selectedLot,
    );
  }
  get selectedUnit() {
    return (
      this.units.value?.find((u) => u.number === this.selectedLot) ??
      this.selectedCotisation?.unit
    );
  }
  state(c: APISchemas["ModelsCotisationResult"]) {
    const state = paymentState(c);
    return state === PaymentState.Overpaid
      ? "Trop-perçu à rembourser"
      : state === PaymentState.Done
        ? "Soldé"
        : (c.paid ?? 0) > 0
          ? "Partiellement réglé"
          : "Sans paiement";
  }
  get mapClasses() {
    const result: Record<number, string> = {};
    for (const unit of this.units.value ?? [])
      if (unit.number !== undefined) result[unit.number] = "dashboard-no-call";
    for (const c of this.finance.value?.cotisations ?? [])
      if (c.unit?.number !== undefined) {
        const state = paymentState(c);
        result[c.unit.number] =
          state === PaymentState.Overpaid
            ? "dashboard-overpaid"
            : state === PaymentState.Done
              ? "dashboard-settled"
              : (c.paid ?? 0) > 0
                ? "dashboard-partial"
                : "dashboard-unpaid";
      }
    return result;
  }
  get comparisonDifference() {
    const selected = this.finance.value?.budget?.amount,
      reference = this.reference.value?.amount;
    return selected == null || reference == null ? null : selected - reference;
  }
  get comparisonPercent() {
    const reference = this.reference.value?.amount,
      difference = this.comparisonDifference;
    return reference == null || reference <= 0 || difference == null
      ? null
      : (difference / reference) * 100;
  }
  get hasActions() {
    return !!(
      (this.finance.value?.recovery?.remaining ?? 0) > 0 ||
      (this.finance.value?.recovery?.overpaid ?? 0) > 0 ||
      (this.emails.value?.counts?.error ?? 0) > 0 ||
      (this.emails.value?.counts?.unknown ?? 0) > 0 ||
      (this.directory.value?.invalid_shares ?? 0) > 0 ||
      (this.administrator && (this.access.value?.pending ?? 0) > 0)
    );
  }
  get actionsComplete() {
    return !!(
      (!this.budgetId || this.finance.value) &&
      this.directory.value &&
      this.emails.value &&
      (!this.administrator || this.access.value)
    );
  }
  businessDate(value?: string) {
    return value
      ? new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris" }).format(
          new Date(value),
        )
      : "—";
  }
  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.financeData$.complete();
    this.budgetChoices$.complete();
  }
}
