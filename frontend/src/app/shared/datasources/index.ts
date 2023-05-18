import {
  CollectionViewer,
  DataSource as MaterialDataSource,
} from '@angular/cdk/collections';
import { BehaviorSubject, Observable, catchError, of, tap } from 'rxjs';

export abstract class DataSource<T> extends MaterialDataSource<T> {
  private _results$ = new BehaviorSubject<T[]>([]);
  readonly results$ = this._results$.asObservable();

  private _loading$ = new BehaviorSubject(false);
  readonly loading$ = this._loading$.asObservable();

  private _loaded$ = new BehaviorSubject(false);
  readonly loaded$ = this._loaded$.asObservable();

  private _error$ = new BehaviorSubject<any | undefined>(undefined);
  readonly error$ = this._error$.asObservable();

  connect(_: CollectionViewer): Observable<T[] | readonly T[]> {
    return this.results$;
  }

  disconnect(_: CollectionViewer): void {
    this._results$.complete();
    this._loading$.complete();
    this._loaded$.complete();
    this._error$.complete();
  }

  protected _setResults(results: T[]): void {
    this._results$.next(results);
    this._loaded$.next(true);
  }

  protected _setLoading(loading: boolean): void {
    this._loading$.next(loading);
  }

  protected _setError(error?: any): void {
    this._error$.next(error);
  }

  protected abstract _fetch(): Observable<T[]>;

  load() {
    this._setLoading(true);
    this._fetch()
      .pipe(
        tap(() => this._setError()),
        catchError((e) => {
          this._setError(e);
          return of([]);
        })
      )
      .subscribe({
        next: (results) => {
          this._setResults(results);
        },
        complete: () => this._setLoading(false),
      });
  }
}

export class EmptyDataSource<T> extends DataSource<T> {
  protected override _fetch(): Observable<T[]> {
    return of([]);
  }
}
