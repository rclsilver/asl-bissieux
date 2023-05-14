import { Component, OnInit } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { AuthService } from 'src/app/core/services/auth.service';

@Component({
  selector: 'app-list-budgets',
  templateUrl: './list-budgets.component.html',
  styleUrls: ['./list-budgets.component.scss'],
})
export class ListBudgetsComponent implements OnInit {
  private _budgets$ = new BehaviorSubject<APISchemas['ModelsBudgetResult'][]>(
    []
  );
  readonly budgets$ = this._budgets$.asObservable();

  readonly canCreate$ = this._auth.allowed$('budget.CreateBudget');

  constructor(private _api: ApiService, private _auth: AuthService) {}

  ngOnInit(): void {
    this.refresh();
  }

  refresh() {
    this._api
      .listBudgets()
      .subscribe((budgets) => this._budgets$.next(budgets!));
  }

  onCancelBudget() {
    console.log('cancel');
  }

  onCreateBudget(payload: APISchemas['CreateBudgetInput']) {
    console.log(payload);
  }

  budgetRowClass(budget: APISchemas['ModelsBudgetResult']) {
    if (budget.draft) {
      return 'table-secondary';
    }

    if ((budget.amount ?? 0) <= (budget.paid ?? 0)) {
      return 'table-success';
    }

    return 'table-warning';
  }
}
