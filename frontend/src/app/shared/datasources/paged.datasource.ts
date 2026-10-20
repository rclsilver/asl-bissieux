import { CollectionViewer } from '@angular/cdk/collections';
import { Sort } from '@angular/material/sort';
import {
  BehaviorSubject,
  Observable,
  Subject,
  Subscription,
  catchError,
  defer,
  finalize,
  map,
  of,
  switchMap,
  tap,
  timer,
} from 'rxjs';
import { DataSource } from '.';

// Normalized UI state; API adapters consume their generated response schemas.
export type PageState = { pageIndex: number; pageSize: number; total: number };
export type PageResult<T> = PageState & { items: T[] };

export abstract class PagedDataSource<T> extends DataSource<T> {
  private readonly reload = new Subject<number>();
  private readonly state = new BehaviorSubject<PageState>({
    pageIndex: 0,
    pageSize: 25,
    total: 0,
  });
  readonly page$ = this.state.asObservable();
  private readonly subscription: Subscription;
  protected pageIndex = 0;
  protected pageSize = 25;
  protected query = '';
  readonly order: Sort = { active: 'created_at', direction: 'desc' };

  constructor() {
    super();
    this.subscription = this.reload
      .pipe(
        switchMap((delay) =>
          defer(() => {
            this._setLoading(true);
            this._setError();
            return (delay ? timer(delay) : of(0)).pipe(
              switchMap(() => this._fetch()),
              catchError((error) => {
                this._setError(error);
                return of<T[]>([]);
              }),
              finalize(() => this._setLoading(false))
            );
          })
        )
      )
      .subscribe((items) => this._setResults(items));
  }
  protected abstract fetchPage(): Observable<PageResult<T>>;
  protected override _fetch() {
    return this.fetchPage().pipe(
      tap((page) => {
        this.pageIndex = page.pageIndex;
        this.pageSize = page.pageSize;
        this.state.next({
          pageIndex: page.pageIndex,
          pageSize: page.pageSize,
          total: page.total,
        });
      }),
      map((page) => page.items)
    );
  }
  override load(delay = 0) {
    this.reload.next(delay);
  }
  setFilter(query: string) {
    if (query === this.query) return;
    this.query = query;
    this.pageIndex = 0;
    // Cancel and disable stale rows immediately, then debounce only the new request.
    this.load(250);
  }
  setSort(sort: Sort) {
    if (
      !sort.direction ||
      (sort.active === this.order.active &&
        sort.direction === this.order.direction)
    )
      return;
    this.order.active = sort.active;
    this.order.direction = sort.direction;
    this.pageIndex = 0;
    this.load();
  }
  setPage(pageIndex: number, pageSize: number) {
    this.pageIndex = pageSize === this.pageSize ? pageIndex : 0;
    this.pageSize = pageSize;
    this.load();
  }
  override disconnect(viewer: CollectionViewer) {
    this.subscription.unsubscribe();
    this.reload.complete();
    this.state.complete();
    super.disconnect(viewer);
  }
}
