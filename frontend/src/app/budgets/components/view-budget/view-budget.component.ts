import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject, combineLatest, map, of, switchMap } from 'rxjs';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { AuthService } from 'src/app/core/services/auth.service';

@Component({
  selector: 'app-view-budget',
  templateUrl: './view-budget.component.html',
  styleUrls: ['./view-budget.component.scss'],
})
export class ViewBudgetComponent implements OnInit {
  private _budget$ = new BehaviorSubject<
    APISchemas['ModelsBudgetResult'] | null
  >(null);
  readonly budget$ = this._budget$.asObservable();

  readonly expenses$ = this.budget$.pipe(
    switchMap((budget) => {
      if (!budget?.id) {
        return of([]);
      }
      return this._api.listExpenses(budget.id);
    })
  );

  readonly cotisations$ = this.budget$.pipe(
    switchMap((budget) => {
      if (!budget?.id) {
        return of([]);
      }
      return this._api.listCotisations(budget.id);
    })
  );

  readonly canPublish$ = combineLatest([
    this._budget$,
    this._auth.user$,
    this._auth.allowed$('budget.PublishBudget'),
  ]).pipe(
    map(([budget, user, allowed]) => {
      if (budget && !budget.draft) {
        return false;
      }

      if (user?.admin) {
        return true;
      }

      return allowed;
    })
  );

  readonly canEdit$ = combineLatest([
    this._budget$,
    this._auth.user$,
    this._auth.allowed$('budget.UpdateBudget'),
  ]).pipe(
    map(([budget, user, allowed]) => {
      if (user?.admin) {
        return true;
      }

      if (!budget || !budget.draft) {
        return false;
      }

      return allowed;
    })
  );

  readonly canDelete$ = combineLatest([
    this._budget$,
    this._auth.user$,
    this._auth.allowed$('budget.DeleteBudget'),
  ]).pipe(
    map(([budget, user, allowed]) => {
      if (user?.admin) {
        return true;
      }

      if (!budget || !budget.draft) {
        return false;
      }

      return allowed;
    })
  );

  readonly budgetActions$ = combineLatest([
    this.canPublish$,
    this.canEdit$,
    this.canDelete$,
  ]).pipe(
    map(
      ([canPublish, canEdit, canDelete]) => canPublish || canEdit || canDelete
    )
  );

  readonly canCreateExpense$ = combineLatest([
    this._budget$,
    this._auth.user$,
    this._auth.allowed$('budget.CreateExpense'),
  ]).pipe(
    map(([budget, user, allowed]) => {
      if (user?.admin) {
        return true;
      }

      if (!budget || !budget.draft) {
        return false;
      }

      return allowed;
    })
  );

  readonly canEditExpense$ = combineLatest([
    this._budget$,
    this._auth.user$,
    this._auth.allowed$('budget.UpdateExpense'),
  ]).pipe(
    map(([budget, user, allowed]) => {
      if (user?.admin) {
        return true;
      }

      if (!budget || !budget.draft) {
        return false;
      }

      return allowed;
    })
  );

  readonly canDeleteExpense$ = combineLatest([
    this._budget$,
    this._auth.user$,
    this._auth.allowed$('budget.DeleteExpense'),
  ]).pipe(
    map(([budget, user, allowed]) => {
      if (user?.admin) {
        return true;
      }

      if (!budget || !budget.draft) {
        return false;
      }

      return allowed;
    })
  );

  readonly expenseActions$ = combineLatest([
    this.canEditExpense$,
    this.canDeleteExpense$,
  ]).pipe(map(([canEdit, canDelete]) => canEdit || canDelete));

  readonly canCreatePayment$ = combineLatest([
    this._budget$,
    this._auth.user$,
    this._auth.allowed$('budget.CreatePayment'),
  ]).pipe(
    map(([budget, user, allowed]) => {
      if (user?.admin) {
        return true;
      }

      if (!budget || budget.draft) {
        return false;
      }

      return allowed;
    })
  );

  constructor(
    private _api: ApiService,
    private _auth: AuthService,
    private _route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.refresh();
  }

  publish() {
    this._route.paramMap
      .pipe(switchMap((params) => this._api.publishBudget(params.get('id')!)))
      .subscribe((budget) => this._budget$.next(budget));
  }

  refresh() {
    this._route.paramMap
      .pipe(switchMap((params) => this._api.getBudget(params.get('id')!)))
      .subscribe((budget) => this._budget$.next(budget));
  }

  cotisationRowClass(cotisation: APISchemas['ModelsCotisationResult']) {
    if (!cotisation.amount /* || cotisation.amount <= cotisation.paid */) {
      return 'table-success';
    }

    if (cotisation.paid) {
      return 'table-warning';
    }

    return 'table-danger';
  }
}
