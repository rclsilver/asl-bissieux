import { DatePipe } from '@angular/common';

export type ValueFunction<In = any, Out = In> = (value: In) => Out;
export type RenderFunction<In = any, Out = In> = (value: In) => Out;
export type SortFunction<T = any> = (a: T, b: T) => number;
export type RenderFactory = (...args: any[]) => RenderFunction;
export type RouteFunction<T = any> = (value: T) => string;

export const DefaultValueRenderer: RenderFactory =
  (defaultValue: any) => (value: any) =>
    value || defaultValue;

export const DateRender: RenderFactory =
  (format: string = 'Y-MM-dd HH:mm:ss') =>
  (value: any) =>
    new DatePipe('en-us').transform(value, format);

export class Column<ColumnType = any, ValueType = ColumnType> {
  readonly name: string;
  readonly label: string;
  readonly defaultSort: boolean;
  readonly canSort: boolean;
  readonly sortFunc: SortFunction<ValueType>;
  readonly render: RenderFunction<ValueType, string>;
  readonly routeTo?: RouteFunction<ColumnType>;

  constructor(name: string, options?: Partial<Column<ColumnType, ValueType>>) {
    this.name = name;
    this.label = options?.label ?? name;
    this.defaultSort = options?.defaultSort ?? false;
    this.canSort = options?.canSort ?? false;
    this.sortFunc =
      options?.sortFunc ??
      ((a: ValueType, b: ValueType) => {
        if (a === b) {
          return 0;
        } else if (a < b) {
          return 1;
        } else {
          return -1;
        }
      });
    this.render = options?.render ?? ((value: ValueType) => value as any);
    this.routeTo = options?.routeTo;
  }

  getValue(row: ColumnType): ValueType {
    const parts = this.name.split('.');
    let value = row as any;

    for (let name = parts.shift(); name; name = parts.shift()) {
      value = value[name];
    }

    return value;
  }

  renderValue(row: ColumnType): any {
    return this.render(this.getValue(row));
  }
}

export class CustomRenderColumn<
  ColumnType = any,
  ValueType = ColumnType
> extends Column<ColumnType, ValueType> {
  private readonly _renderValue: (row: ColumnType) => ValueType;

  constructor(
    name: string,
    renderValue: (row: ColumnType) => ValueType,
    options?: Partial<Column<ColumnType, ValueType>>
  ) {
    super(name, options);
    this._renderValue = renderValue;
  }

  override getValue(row: ColumnType): ValueType {
    return this._renderValue(row);
  }
}
