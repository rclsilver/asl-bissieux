import { Observable, of } from 'rxjs';
import { DataSource } from '.';

export class EmptyDataSource<T> extends DataSource<T> {
  protected override _fetch(): Observable<T[]> {
    return of([]);
  }
}
