import { inject } from '@angular/core';
import { CollectionViewer } from '@angular/cdk/collections';
import {
  BehaviorSubject,
  Subject,
  catchError,
  combineLatest,
  finalize,
  forkJoin,
  map,
  of,
  takeUntil,
  tap,
  throwError,
} from 'rxjs';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { DataSource } from 'src/app/shared/datasources';
import { compareMembers, memberMatches } from '../member-directory';

export class MemberDataSource extends DataSource<APISchemas['ModelsMember']> {
  private readonly api = inject(ApiService);
  private readonly disconnected = new Subject<void>();
  private readonly query = new BehaviorSubject('');
  private readonly units = new BehaviorSubject<APISchemas['ModelsUnit'][]>([]);
  private readonly unitsError = new BehaviorSubject<unknown>(undefined);
  private readonly unitsLoading = new BehaviorSubject(false);
  readonly units$ = this.units.asObservable();
  readonly unitsError$ = this.unitsError.asObservable();
  readonly unitsLoading$ = this.unitsLoading.asObservable();
  get allResults$() {
    return super.results$;
  }
  override get results$() {
    return combineLatest([super.results$, this.query]).pipe(
      map(([members, query]) =>
        members.filter((member) => memberMatches(member, query))
      )
    );
  }
  setQuery(query: string) {
    this.query.next(query);
  }
  private fetchUnits() {
    this.unitsLoading.next(true);
    return this.api.listUnits().pipe(
      tap((units) => {
        this.units.next(units);
        this.unitsError.next(undefined);
      }),
      catchError((error) => {
        this.unitsError.next(error);
        return of<APISchemas['ModelsUnit'][]>([]);
      }),
      finalize(() => this.unitsLoading.next(false))
    );
  }
  retryUnits() {
    if (!this.unitsLoading.value)
      this.fetchUnits().pipe(takeUntil(this.disconnected)).subscribe();
  }
  protected override _fetch() {
    return forkJoin({
      members: this.api.listMembers(),
      units: this.fetchUnits(),
    }).pipe(
      map((result) => [...result.members].sort(compareMembers)),
      catchError((error) => {
        this.units.next([]);
        return throwError(() => error);
      })
    );
  }
  override disconnect(viewer: CollectionViewer) {
    this.disconnected.next();
    this.disconnected.complete();
    this.query.complete();
    this.units.complete();
    this.unitsError.complete();
    this.unitsLoading.complete();
    super.disconnect(viewer);
  }
}
