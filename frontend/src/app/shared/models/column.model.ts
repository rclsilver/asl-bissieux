import { DatePipe } from '@angular/common';

export type ValueFunction<T = any> = (value: T) => any;
export type RenderFunction<T = any> = (value: T) => any;
export type RenderFactory = (...args: any[]) => RenderFunction;
export type RouteFunction<T = any> = (value: T) => string;

export const DefaultValueRenderer: RenderFactory =
  (defaultValue: any) => (value: any) =>
    value || defaultValue;

export const DateRender: RenderFactory =
  (format: string = 'Y-MM-dd HH:mm:ss') =>
  (value: any) =>
    new DatePipe('en-us').transform(value, format);

export class Column<T = any> {
  readonly name: string;
  readonly label: string;
  readonly defaultSort: boolean;
  readonly canSort: boolean;
  readonly render: RenderFunction<T>;
  readonly routeTo?: RouteFunction<T>;

  constructor(name: string, options?: Partial<Column<T>>) {
    this.name = name;
    this.label = options?.label ?? name;
    this.defaultSort = options?.defaultSort ?? false;
    this.canSort = options?.canSort ?? false;
    this.render = options?.render ?? ((value: T) => value);
    this.routeTo = options?.routeTo;
  }

  getValue(row: T): any {
    const parts = this.name.split('.');
    let value = row as any;

    for (let name = parts.shift(); name; name = parts.shift()) {
      value = value[name];
    }

    return value;
  }

  renderValue(row: any): any {
    return this.render(this.getValue(row));
  }
}

export class CustomRenderColumn<T = any> extends Column<T> {
  private readonly _renderValue: (row: T) => any;

  constructor(
    name: string,
    renderValue: (row: T) => any,
    options?: Partial<Column<T>>
  ) {
    super(name, options);
    this._renderValue = renderValue;
  }

  override getValue(row: T) {
    return this._renderValue(row);
  }
}
