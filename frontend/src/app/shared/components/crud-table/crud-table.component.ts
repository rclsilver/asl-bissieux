import {
  AfterViewInit,
  Component,
  ContentChildren,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  QueryList,
  ViewChild,
  ViewChildren,
} from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  Subject,
  combineLatest,
  map,
  switchMap,
  takeUntil,
} from 'rxjs';
import { DataSource, EmptyDataSource } from '../../datasources';
import { Column } from '../../models/column.model';
import { MatColumnDef, MatTable } from '@angular/material/table';

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

export type RowClassFunction<T = any> = (row: T) => string | undefined;
export type CanEditFunction<T = any> = (row: T) => Observable<boolean>;
export type CanDeleteFunction<T = any> = (row: T) => Observable<boolean>;

@Component({
  selector: 'app-crud-table',
  templateUrl: './crud-table.component.html',
  styleUrls: ['./crud-table.component.scss'],
})
export class CrudTableComponent<T extends {}>
  implements OnInit, OnDestroy, AfterViewInit
{
  private _destroyed$ = new Subject<void>();

  private _rowActions$ = new BehaviorSubject<CustomRowAction<T>[]>([]);

  private _dataSource$ = new BehaviorSubject<DataSource<T>>(
    new EmptyDataSource<T>()
  );

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

  private _columnDefs$ = new BehaviorSubject<Column[]>([]);
  readonly columnDefs$ = this._columnDefs$.asObservable();

  private _customColumnDefs$ = new BehaviorSubject<MatColumnDef[]>([]);

  readonly columns$ = combineLatest([
    this.columnDefs$,
    this._customColumnDefs$.asObservable(),
    this.showActions$,
  ]).pipe(
    map(([columnDefs, customColumnDefs, showActions]) => {
      return [
        columnDefs.map((c) => c.name),
        customColumnDefs.map((c) => c.name),
        showActions ? ['_actions_'] : [],
      ];
    }),
    map(([columns, customColumns, showActions]) => {
      return [...new Set([...columns, ...customColumns, ...showActions])];
    })
  );
  readonly columnsCount$ = this.columns$.pipe(map((columns) => columns.length));

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
    this._dataSource$.next(dataSource);
  }

  @ViewChildren(MatColumnDef) defaultColumns?: QueryList<MatColumnDef>;
  @ContentChildren(MatColumnDef) customColumns?: QueryList<MatColumnDef>;

  @ViewChild(MatTable, { static: true }) table!: MatTable<T>;

  @Output() edit = new EventEmitter<T | undefined>();
  @Output() delete = new EventEmitter<T>();

  ngOnInit(): void {
    this.refresh();
  }

  ngAfterViewInit(): void {
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

    this._dataSource$.pipe(takeUntil(this._destroyed$)).subscribe((ds) => {
      this.table.dataSource = ds;
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
