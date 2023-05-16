import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { DataSource } from 'src/app/shared/datasources';

export class PaymentDataSource extends DataSource<APISchemas['ModelsPayment']> {
  constructor(
    private readonly _api: ApiService,
    private readonly _budgetId: string,
    private readonly _cotisationId: string
  ) {
    super();
  }

  protected override _fetch() {
    return this._api.listPayments(this._budgetId, this._cotisationId);
  }
}
