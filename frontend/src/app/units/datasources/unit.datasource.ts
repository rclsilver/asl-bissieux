import { BehaviorSubject, combineLatest, map } from 'rxjs';
import { inject } from '@angular/core';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { DataSource } from 'src/app/shared/datasources';

export class UnitDataSource extends DataSource<APISchemas['ModelsUnit']> {
  private readonly quality$ = new BehaviorSubject('');
  setQuality(quality: string) {
    this.quality$.next(quality);
  }
  override get results$() {
    return combineLatest([super.results$, this.quality$]).pipe(
      map(([units, quality]) =>
        units.filter((unit) =>
          quality === 'no_member'
            ? !unit.members?.length
            : quality === 'invalid_shares'
              ? (unit.share ?? 0) <= 0
              : true
        )
      )
    );
  }
  private readonly _api = inject(ApiService);

  protected override _fetch() {
    return this._api.listUnits();
  }
}
