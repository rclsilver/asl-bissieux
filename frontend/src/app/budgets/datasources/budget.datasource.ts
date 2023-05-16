import { inject } from '@angular/core';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { DataSource } from 'src/app/shared/datasources';

export class BudgetDataSource extends DataSource<
  APISchemas['ModelsBudgetResult']
> {
  private readonly _api = inject(ApiService);

  protected override _fetch() {
    return this._api.listBudgets();
  }
}
