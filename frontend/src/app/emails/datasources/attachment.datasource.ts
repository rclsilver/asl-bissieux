import { inject } from '@angular/core';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { DataSource } from 'src/app/shared/datasources';

export class EmailAttachmentDataSource extends DataSource<
  APISchemas['ModelsAttachment']
> {
  private readonly _api = inject(ApiService);

  constructor(private readonly _templateId: string) {
    super();
  }

  protected override _fetch() {
    return this._api.listEmailAttachments(this._templateId);
  }
}
