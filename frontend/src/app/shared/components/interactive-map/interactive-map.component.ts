import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';

export type UnitClickEvent = {
  unitId: number;
  event: MouseEvent;
};

export type UnitClasses = { [unitId: number]: string };

@Component({
  selector: 'app-interactive-map',
  templateUrl: './interactive-map.component.svg',
  styleUrls: ['./interactive-map.component.scss'],
})
export class InteractiveMapComponent implements AfterViewInit {
  private readonly _svgWidth = 1871;
  private readonly _svgHeight = 1459.47;

  private readonly _defaultWidth = 1000;
  private readonly _defaultHeight =
    (this._defaultWidth * this._svgHeight) / this._svgWidth;

  private _width?: number;
  private _height?: number;

  private _classes: UnitClasses = {};

  @Input() set width(v: number) {
    this._width = v;

    if (this._height === undefined) {
      this._height = (v * this._svgHeight) / this._svgWidth;
    }

    if (this.container) {
      this.setWidth(v);
    }
  }
  @Input() set height(v: number) {
    this._height = v;

    if (this._width === undefined) {
      this._width = (v * this._svgWidth) / this._svgHeight;
    }

    if (this.container) {
      this.setHeight(v);
    }
  }

  @Input() set unitClasses(classes: UnitClasses) {
    this._classes = classes;

    if (this.container) {
      this.setUnitClasses(classes);
    }
  }

  private _showLabels = true;

  @Input() set showLabels(v: boolean) {
    this._showLabels = v;

    if (this.container) {
      this.setShowLabels(v);
    }
  }
  @Input() hoverClass = '';

  @Output() unitClick = new EventEmitter<UnitClickEvent>();

  @ViewChild('svg') container!: ElementRef<SVGElement>;

  ngAfterViewInit() {
    this.setWidth(this._width ?? this._defaultWidth);
    this.setHeight(this._height ?? this._defaultHeight);

    this.setUnitClasses(this._classes);
    this.setShowLabels(this._showLabels);

    this.foreachUnits((unitId, element) => {
      element.onmouseenter = (e) => {
        if (this.hoverClass) {
          element.classList.add(this.hoverClass);
        }
      };

      element.onmouseleave = (e) => {
        if (this.hoverClass) {
          element.classList.remove(this.hoverClass);
        }
      };

      element.onclick = (event) => {
        this.unitClick.emit({
          unitId,
          event,
        });
      };
    });
  }

  private setWidth(width: number) {
    this.container.nativeElement.setAttribute('width', `${width}px`);
  }

  private setHeight(height: number) {
    this.container.nativeElement.setAttribute('height', `${height}px`);
  }

  private setUnitClasses(classes: UnitClasses) {
    this.foreachUnits((unitId, element) => {
      const cls = classes[unitId];

      // remove old classes
      element.classList.forEach((c) => element.classList.remove(c));

      // set class if defined
      if (cls) {
        element.classList.add(cls);
      }
    });
  }

  private setShowLabels(v: boolean) {
    this.foreachUnits((_, element) => {
      element.querySelectorAll<SVGGElement>('g[id^=label]').forEach((label) => {
        if (v) {
          label.classList.remove('hidden');
        } else {
          label.classList.add('hidden');
        }
      });
    });
  }

  private foreachUnits(cb: (unitId: number, element: SVGGElement) => void) {
    this.container.nativeElement
      .querySelectorAll<SVGGElement>('#units [id^=unit-]')
      .forEach((element) => {
        const unitId = +element.id.replaceAll(/^unit-0?/g, '');

        cb(unitId, element);
      });
  }
}
