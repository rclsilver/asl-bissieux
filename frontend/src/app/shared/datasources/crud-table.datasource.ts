import { Observable, combineLatest, map, startWith, tap } from 'rxjs';
import { AbstractDataSource, DataSource } from '.';
import { Column } from '../models/column.model';
import { CollectionViewer } from '@angular/cdk/collections';
import { Sort } from '@angular/material/sort';

export type CrudTableColumn = {
  value: any;
  display: string;
  route?: string;
};

export type CrudTableRow<T extends {}> = {
  columns: { [k: string]: CrudTableColumn };
  original: T;
};

export class CrudTableDataSource<T extends {}> extends AbstractDataSource<
  CrudTableRow<T>
> {
  override get results$(): Observable<
    CrudTableRow<T>[] | readonly CrudTableRow<T>[]
  > {
    return combineLatest([
      this._columns$,
      this._source.results$,
      this._sort$.pipe(startWith(null)),
    ]).pipe(
      map(([columns, results, sort]) => {
        return results
          .map((result) => {
            const row: CrudTableRow<T> = {
              columns: {},
              original: result,
            };

            for (let column of columns) {
              row.columns[column.name] = {
                value: column.getValue(result),
                display: column.renderValue(result),
                route: column.routeTo ? column.routeTo(result) : undefined,
              };
            }

            return row;
          })
          .sort((a, b) => {
            if (!sort || !sort.active) {
              return 0;
            }

            const aValue = a.columns[sort.active].value;
            const bValue = b.columns[sort.active].value;

            if (aValue === bValue) {
              return 0;
            }

            if (aValue < bValue) {
              return sort.direction === 'asc' ? 1 : -1;
            }

            return sort.direction === 'asc' ? -1 : 1;
          });
      })
    );
  }

  override get loading$(): Observable<boolean> {
    return this._source.loading$;
  }

  override get loaded$(): Observable<boolean> {
    return this._source.loaded$;
  }

  override get error$(): Observable<any> {
    return this._source.error$;
  }

  constructor(
    private readonly _source: DataSource<T>,
    private readonly _columns$: Observable<Column<T>[]>,
    private readonly _sort$: Observable<Sort>
  ) {
    super();
  }

  load(): void {
    this._source.load();
  }

  override disconnect(collectionViewer: CollectionViewer): void {
    this._source.disconnect(collectionViewer);
  }
}
