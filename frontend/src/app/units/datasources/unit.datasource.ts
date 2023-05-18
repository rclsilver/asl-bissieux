import { inject } from '@angular/core';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { DataSource } from 'src/app/shared/datasources';

export class UnitDataSource extends DataSource<APISchemas['ModelsUnit']> {
  private readonly _api = inject(ApiService);

  protected override _fetch() {
    return this._api.listUnits();
  }
}
