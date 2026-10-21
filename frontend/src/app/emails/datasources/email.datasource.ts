import { map } from 'rxjs';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { PagedDataSource } from 'src/app/shared/datasources/paged.datasource';

export class EmailDataSource extends PagedDataSource<
  APISchemas['ModelsEmailSummary']
> {
  private filterState = '';
  constructor(
    private readonly api: ApiService,
    private readonly campaignId: string,
    initialState = ''
  ) {
    super();
    this.filterState = initialState;
  }
  setState(state: string) {
    if (state === this.filterState) return;
    this.filterState = state;
    this.pageIndex = 0;
    this.load();
  }
  protected override fetchPage() {
    return this.api
      .listEmails(this.campaignId, {
        page: this.pageIndex + 1,
        page_size: this.pageSize,
        query: this.query,
        sort: this.order.active,
        direction: this.order.direction,
        state: this.filterState || undefined,
      })
      .pipe(
        map((response) => {
          if (!response) throw new Error('Missing email page');
          return {
            items: response.items ?? [],
            pageIndex: (response.page ?? 1) - 1,
            pageSize: response.page_size ?? this.pageSize,
            total: response.total ?? 0,
          };
        })
      );
  }
}
