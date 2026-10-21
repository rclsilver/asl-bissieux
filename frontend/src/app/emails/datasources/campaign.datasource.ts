import { inject } from '@angular/core';
import { map } from 'rxjs';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { PagedDataSource } from 'src/app/shared/datasources/paged.datasource';

export class EmailCampaignDataSource extends PagedDataSource<
  APISchemas['ModelsEmailCampaignSummary']
> {
  private filterState = '';
  setState(state: string) {
    this.filterState = state;
    this.pageIndex = 0;
    this.load();
  }
  private readonly api = inject(ApiService);
  protected override fetchPage() {
    return this.api
      .listEmailCampaigns({
        state: this.filterState || undefined,
        page: this.pageIndex + 1,
        page_size: this.pageSize,
        query: this.query,
        sort: this.order.active,
        direction: this.order.direction,
      })
      .pipe(
        map((response) => {
          if (!response) throw new Error('Missing campaign page');
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
