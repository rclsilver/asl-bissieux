import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { DataSource } from 'src/app/shared/datasources';

export class EmailDataSource extends DataSource<APISchemas['ModelsEmail']> {
  constructor(
    private readonly _api: ApiService,
    private readonly _campaignId: string
  ) {
    super();
  }

  protected override _fetch() {
    return this._api.listEmails(this._campaignId);
  }
}
