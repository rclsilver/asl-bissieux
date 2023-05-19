import {
  CollectionViewer,
  DataSource as MaterialDataSource,
} from '@angular/cdk/collections';
import {
  BehaviorSubject,
  Observable,
  Subject,
  catchError,
  of,
  takeUntil,
  tap,
} from 'rxjs';

export abstract class AbstractDataSource<T> extends MaterialDataSource<T> {
  abstract get results$(): Observable<T[] | readonly T[]>;

  abstract get loading$(): Observable<boolean>;

  abstract get loaded$(): Observable<boolean>;

  abstract get error$(): Observable<any | undefined>;

  override connect(_: CollectionViewer): Observable<T[] | readonly T[]> {
    return this.results$;
  }

  abstract load(): void;
}

export abstract class DataSource<T> extends AbstractDataSource<T> {
  private _disconnected$ = new Subject<void>();
  private _results$ = new BehaviorSubject<T[]>([]);

  override get results$() {
    return this._results$.asObservable();
  }

  private _loading$ = new BehaviorSubject(false);

  override get loading$() {
    return this._loading$.asObservable();
  }

  private _loaded$ = new BehaviorSubject(false);

  override get loaded$() {
    return this._loaded$.asObservable();
  }

  private _error$ = new BehaviorSubject<any | undefined>(undefined);

  override get error$() {
    return this._error$.asObservable();
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

  override disconnect(_: CollectionViewer): void {
    this._disconnected$.next();
    this._disconnected$.complete();
    this._results$.complete();
    this._loading$.complete();
    this._loaded$.complete();
    this._error$.complete();
  }

  override load() {
    this._setLoading(true);
    this._fetch()
      .pipe(
        takeUntil(this._disconnected$),
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
