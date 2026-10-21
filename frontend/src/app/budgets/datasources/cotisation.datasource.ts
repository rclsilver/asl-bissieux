import { BehaviorSubject, combineLatest, map } from 'rxjs';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { DataSource } from 'src/app/shared/datasources';

export class CotisationDataSource extends DataSource<
  APISchemas['ModelsCotisationResult']
> {
  get allResults$() {
    return super.results$;
  }
  private readonly filter$ = new BehaviorSubject({ coverage: '', id: '' });
  setScope(coverage: string, id: string) {
    this.filter$.next({ coverage, id });
  }
  override get results$() {
    return combineLatest([super.results$, this.filter$]).pipe(
      map(([rows, scope]) =>
        rows.filter((c) => {
          if (scope.id && c.id !== scope.id) return false;
          const remaining = c.remaining ?? (c.amount ?? 0) - (c.paid ?? 0),
            paid = c.paid ?? 0;
          switch (scope.coverage) {
            case 'received':
              return paid > 0;
            case 'remaining':
              return remaining > 0;
            case 'settled':
              return remaining <= 0;
            case 'partial':
              return paid > 0 && remaining > 0;
            case 'unpaid':
              return paid <= 0 && remaining > 0;
            case 'overpaid':
              return remaining < 0;
            default:
              return true;
          }
        })
      )
    );
  }
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
