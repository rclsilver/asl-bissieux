import {
  AfterViewInit,
  Component,
  ContentChildren,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  QueryList,
  ViewChild,
  ViewChildren,
} from '@angular/core';
import {
  BehaviorSubject,
  NEVER,
  Observable,
  Subject,
  combineLatest,
  distinctUntilChanged,
  first,
  map,
  skip,
  switchMap,
  takeUntil,
} from 'rxjs';
import { DataSource } from '../../datasources';
import { Column } from '../../models/column.model';
import { MatColumnDef, MatTable } from '@angular/material/table';
import { EmptyDataSource } from '../../datasources/empty.datasource';
import {
  CrudTableDataSource,
  CrudTableRow,
} from '../../datasources/crud-table.datasource';
import { MatSort } from '@angular/material/sort';
import { SearchInputComponent } from '../search-input/search-input.component';

export class CustomAction {
  constructor(public readonly icon: string, public readonly tooltip: string) {}
}

export class CustomToolbarAction extends CustomAction {
  constructor(
    icon: string,
    tooltip: string,
    public readonly func: () => void,
    public readonly loading$?: Observable<boolean>,
    public readonly loadingTooltip?: string
  ) {
    super(icon, tooltip);
  }
}

export class CustomRowAction<T> extends CustomAction {
  constructor(
    icon: string,
    tooltip: string,
    public readonly label: string,
    public readonly func: (row: T) => void,
    public readonly show: (row: T) => boolean = (_) => true,
    public readonly disabled: (row: T) => boolean = (_) => false
  ) {
    super(icon, tooltip);
  }
}

export class SelectionModel<T> {
  private readonly _selected$ = new BehaviorSubject<{ hash: string; row: T }[]>(
    []
  );

  readonly selected$ = this._selected$.pipe(
    map((items) => items.map((item) => item.row)),
    distinctUntilChanged()
  );

  private _getIndex(row: T): number {
    const hash = JSON.stringify(row);
    return this._selected$.value.findIndex((value) => value.hash === hash);
  }

  toggle(row: T): void {
    const index = this._getIndex(row);
    const hash = JSON.stringify(row);

    if (index === -1) {
      this._selected$.next([...this._selected$.value, { hash, row }]);
    } else {
      this._selected$.next(
        this._selected$.value.filter((item) => item.hash !== hash)
      );
    }
  }

  isSelected(row: T): boolean {
    return this._getIndex(row) !== -1;
  }
}

export type RowClassFunction<T = any> = (row: T) => string | undefined;
export type CanEditFunction<T = any> = (row: T) => Observable<boolean>;
export type CanDeleteFunction<T = any> = (row: T) => Observable<boolean>;

@Component({
  selector: 'app-crud-table',
  templateUrl: './crud-table.component.html',
  styleUrls: ['./crud-table.component.scss'],
})
export class CrudTableComponent<T extends {}>
  implements OnDestroy, AfterViewInit
{
  private _destroyed$ = new Subject<void>();

  private _rowActions$ = new BehaviorSubject<CustomRowAction<T>[]>([]);

  private _canSelect$ = new BehaviorSubject(false);

  @Input() set canSelect(canSelect: boolean | Observable<boolean>) {
    if (typeof canSelect === 'boolean') {
      this._canSelect$.next(canSelect);
    } else {
      canSelect
        .pipe(takeUntil(this._destroyed$))
        .subscribe((v) => this._canSelect$.next(v));
    }
  }

  readonly selected = new SelectionModel<T>();

  private _canEdit$ = new BehaviorSubject(false);
  private _canEditFunc$ = new BehaviorSubject<CanEditFunction<T> | undefined>(
    undefined
  );

  canEditRow(row: T) {
    if (this._canEditFunc$.value) {
      return this._canEditFunc$.value(row);
    } else {
      return this._canEdit$.asObservable();
    }
  }

  private _canDelete$ = new BehaviorSubject(false);
  private _canDeleteFunc$ = new BehaviorSubject<
    CanDeleteFunction<T> | undefined
  >(undefined);

  canDeleteRow(row: T) {
    if (this._canDeleteFunc$.value) {
      return this._canDeleteFunc$.value(row);
    } else {
      return this._canDelete$.asObservable();
    }
  }

  readonly showActions$ = combineLatest([
    this._canEdit$,
    this._canEditFunc$,
    this._canDelete$,
    this._canDeleteFunc$,
    this._rowActions$,
  ]).pipe(
    map(
      ([canEdit, canEditFunc, canDelete, canDeleteFunc, rowActions]) =>
        canEdit ||
        canDelete ||
        !!canEditFunc ||
        !!canDeleteFunc ||
        rowActions.length > 0
    )
  );

  @Input() rowClass: RowClassFunction<T> = (_) => undefined;

  private _canCreate$ = new BehaviorSubject(false);
  readonly canCreate$ = this._canCreate$.asObservable();

  @Input() set canCreate(canCreate: Observable<boolean> | boolean) {
    if (typeof canCreate === 'boolean') {
      this._canCreate$.next(canCreate);
    } else {
      canCreate
        .pipe(takeUntil(this._destroyed$))
        .subscribe((canCreate) => this._canCreate$.next(canCreate));
    }
  }

  @Input() set canEdit(canEdit: boolean | CanEditFunction<T>) {
    if (canEdit) {
      if (typeof canEdit === 'function') {
        this._canEdit$.next(false);
        this._canEditFunc$.next(canEdit);
      } else {
        this._canEdit$.next(canEdit);
        this._canEditFunc$.next(undefined);
      }
    } else {
      this._canEdit$.next(false);
      this._canEditFunc$.next(undefined);
    }
  }

  @Input() set canDelete(canDelete: boolean | CanDeleteFunction<T>) {
    if (canDelete) {
      if (typeof canDelete === 'function') {
        this._canDelete$.next(false);
        this._canDeleteFunc$.next(canDelete);
      } else {
        this._canDelete$.next(canDelete);
        this._canDeleteFunc$.next(undefined);
      }
    } else {
      this._canDelete$.next(false);
      this._canDeleteFunc$.next(undefined);
    }
  }

  @Input() canRefresh = true;

  @Input() toolbarActions: CustomToolbarAction[] | null = null;
  @Input() set rowActions(actions: CustomRowAction<T>[] | null) {
    if (actions) {
      this._rowActions$.next(actions);
    } else {
      this._rowActions$.next([]);
    }
  }

  get rowActions() {
    return this._rowActions$.value;
  }

  private _columnDefs$ = new BehaviorSubject<Column<T>[]>([]);
  readonly columnDefs$ = this._columnDefs$.asObservable();

  private _customColumnDefs$ = new BehaviorSubject<MatColumnDef[]>([]);

  readonly columns$ = combineLatest([
    this.columnDefs$,
    this._customColumnDefs$.asObservable(),
    this.showActions$,
    this._canSelect$,
  ]).pipe(
    map(([columnDefs, customColumnDefs, showActions, canSelect]) => {
      return [
        canSelect ? ['_select_'] : [],
        columnDefs.filter((c) => !c.hidden).map((c) => c.name),
        customColumnDefs.map((c) => c.name),
        showActions ? ['_actions_'] : [],
      ];
    }),
    map(([select, columns, customColumns, actions]) => {
      return [
        ...new Set([...select, ...columns, ...customColumns, ...actions]),
      ];
    })
  );
  readonly columnsCount$ = this.columns$.pipe(map((columns) => columns.length));

  private _dataSource$ = new BehaviorSubject<CrudTableDataSource<T>>(
    new CrudTableDataSource<T>(
      new EmptyDataSource<T>(),
      this._columnDefs$,
      NEVER,
      NEVER
    )
  );

  readonly loading$ = this._dataSource$.pipe(switchMap((ds) => ds.loading$));
  readonly loaded$ = this._dataSource$.pipe(switchMap((ds) => ds.loaded$));
  readonly error$ = this._dataSource$.pipe(switchMap((ds) => ds.error$));

  @Input() set columns(columns: Column[]) {
    this._columnDefs$.next(columns);
  }

  get columns(): Column[] {
    return this._columnDefs$.getValue();
  }

  @Input() set dataSource(dataSource: DataSource<T> | null) {
    if (dataSource === null) {
      dataSource = new EmptyDataSource<T>();
    }

    this._dataSource$.next(
      new CrudTableDataSource<T>(
        dataSource,
        this._columnDefs$,
        this.sort.sortChange,
        this.search.onPatternChange.asObservable()
      )
    );
  }

  @ViewChildren(MatColumnDef) defaultColumns?: QueryList<MatColumnDef>;
  @ContentChildren(MatColumnDef) customColumns?: QueryList<MatColumnDef>;

  @ViewChild(MatTable, { static: true }) table!: MatTable<CrudTableRow<T>>;
  @ViewChild(MatSort, { static: true }) sort!: MatSort;
  @ViewChild(SearchInputComponent, { static: true })
  search!: SearchInputComponent;

  @Output() edit = new EventEmitter<T | undefined>();
  @Output() delete = new EventEmitter<T>();

  readonly filters$ = this._columnDefs$.pipe(
    map((columns) => columns.filter((c) => c.canFilter))
  );

  ngOnInit() {
    this.refresh();
  }

  ngAfterViewInit(): void {
    // set the table datasource
    this._dataSource$.pipe(takeUntil(this._destroyed$)).subscribe((ds) => {
      this.table.dataSource = ds;
    });

    // if select is enabled, unselect non-existant results
    this._dataSource$.pipe(takeUntil(this._destroyed$)).subscribe((ds) => {
      ds.results$
        .pipe(
          takeUntil(this._destroyed$),
          takeUntil(this._dataSource$.pipe(skip(1)))
        )
        .subscribe((result) => {
          this.selected.selected$.pipe(first()).subscribe((rows) => {
            rows.forEach((row) => {
              if (
                result.findIndex(
                  (item) =>
                    JSON.stringify(item.original) === JSON.stringify(row)
                ) === -1
              ) {
                this.selected.toggle(row);
              }
            });
          });
        });
    });

    // load datasource
    this._dataSource$
      .pipe(takeUntil(this._destroyed$), skip(1))
      .subscribe((ds) => {
        if (ds) {
          ds.load();
        }
      });

    this._columnDefs$.pipe(takeUntil(this._destroyed$)).subscribe((columns) => {
      this.sort.active = '';

      // Define default active sort
      for (let column of columns!) {
        if (column.canSort && column.defaultSort) {
          this.sort.active = column.name;
          break;
        }
      }

      if (!this.sort.active) {
        for (let column of columns) {
          if (column.canSort) {
            this.sort.active = column.name;
            break;
          }
        }
      }
    });

    (this.customColumns ?? []).forEach((custom) => {
      const defaultColumn = (this.defaultColumns ?? []).filter(
        (column) => column.name === custom.name
      )[0];

      if (defaultColumn) {
        defaultColumn.cell = custom.cell;
      } else {
        this.table.addColumnDef(custom);
        this._customColumnDefs$.next([
          ...this._customColumnDefs$.getValue(),
          custom,
        ]);
      }
    });
  }

  ngOnDestroy(): void {
    this._destroyed$.next();
    this._destroyed$.complete();
  }

  onEdit(row?: T) {
    this.edit.emit(row);
  }

  onDelete(row: T) {
    this.delete.emit(row);
  }

  refresh() {
    this._dataSource$.value.load();
  }
}
