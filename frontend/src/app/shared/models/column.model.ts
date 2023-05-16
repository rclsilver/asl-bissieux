import { DatePipe } from '@angular/common';

export type RenderFunction = (value: any) => any;
export type RenderFactory = (...args: any[]) => RenderFunction;
export type RouteFunction = (value: any) => string;

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
  readonly sortColumn: string;
  readonly render: RenderFunction;
  readonly routeTo?: RouteFunction;

  constructor(name: string, options?: Partial<Column<T>>) {
    this.name = name;
    this.label = options?.label ?? name;
    this.defaultSort = options?.defaultSort ?? false;
    this.canSort = options?.defaultSort ?? false;
    this.sortColumn = options?.sortColumn || name;
    this.render = options?.render ?? ((value: T) => value);
    this.routeTo = options?.routeTo;
  }

  renderValue(row: any): any {
    const parts = this.name.split('.');
    let value = row;

    for (let name = parts.shift(); name; name = parts.shift()) {
      value = value[name];
    }

    return this.render(value);
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

  override renderValue(row: any): any {
    return this.render(this._renderValue(row));
  }
}
