import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { DataSource } from 'src/app/shared/datasources';

export class CotisationDataSource extends DataSource<
  APISchemas['ModelsCotisationResult']
> {
  constructor(
    private readonly _api: ApiService,
    private readonly _budgetId: string
  ) {
    super();
  }

  protected override _fetch() {
    return this._api.listCotisations(this._budgetId);
  }
}
