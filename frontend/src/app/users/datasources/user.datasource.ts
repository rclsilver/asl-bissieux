import { CollectionViewer } from '@angular/cdk/collections';
import { Subject, takeUntil } from 'rxjs';
import { inject } from '@angular/core';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { DataSource } from 'src/app/shared/datasources';

export class UserDataSource extends DataSource<APISchemas['AuthUser']> {
  private readonly cancel$ = new Subject<void>();
  override load() {
    this.cancel$.next();
    super.load();
  }
  override disconnect(viewer: CollectionViewer) {
    this.cancel$.next();
    this.cancel$.complete();
    super.disconnect(viewer);
  }
  status = '';
  private readonly _api = inject(ApiService);

  protected override _fetch() {
    return this._api
      .listUsers({ status: this.status || undefined })
      .pipe(takeUntil(this.cancel$));
  }
}
