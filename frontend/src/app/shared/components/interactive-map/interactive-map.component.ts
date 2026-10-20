import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  ChangeDetectionStrategy,
} from '@angular/core';

export type UnitClickEvent = {
  // Historical name: this is the number from the SVG, not the database UUID.
  unitId: number;
  event: MouseEvent | KeyboardEvent;
};

export type UnitClasses = { [unitId: number]: string };

@Component({
  selector: 'app-interactive-map',
  templateUrl: './interactive-map.component.svg',
  styleUrls: ['./interactive-map.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
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
  private readonly appliedClasses = new Map<number, string[]>();
  private _highlightedUnits: number[] = [];
  private _selectedUnit: number | null = null;
  private activeUnit?: number;
  private unitElements: { number: number; element: SVGGElement }[] = [];
  @Input() label = 'Carte des lots';
  @Input() set highlightedUnits(units: number[]) {
    this._highlightedUnits = units ?? [];
    if (this.container) this.setSelection();
  }
  @Input() set selectedUnit(number: number | null) {
    this._selectedUnit = number;
    if (number !== null) this.activeUnit = number;
    if (this.container) {
      this.setSelection();
      this.setTabStops();
    }
  }

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
      this.unitElements.push({ number: unitId, element });
      element.setAttribute('role', 'button');
      element.setAttribute('aria-label', `Consulter le lot ${unitId}`);
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
      element.onfocus = () => {
        this.activeUnit = unitId;
        this.setTabStops();
      };
      element.onkeydown = (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (!event.repeat) this.unitClick.emit({ unitId, event });
        } else {
          const index = this.unitElements.findIndex(
            (unit) => unit.number === unitId
          );
          let next: number;
          switch (event.key) {
            case 'ArrowRight':
            case 'ArrowDown':
              next = Math.min(index + 1, this.unitElements.length - 1);
              break;
            case 'ArrowLeft':
            case 'ArrowUp':
              next = Math.max(index - 1, 0);
              break;
            case 'Home':
              next = 0;
              break;
            case 'End':
              next = this.unitElements.length - 1;
              break;
            default:
              return;
          }
          event.preventDefault();
          this.unitElements[next]?.element.focus();
        }
      };
    });
    this.unitElements.sort((a, b) => a.number - b.number);
    this.setSelection();
    this.setTabStops();
  }

  private setSelection() {
    this.foreachUnits((number, element) => {
      element.classList.toggle(
        'unit-highlighted',
        this._highlightedUnits.includes(number)
      );
      element.classList.toggle('unit-selected', this._selectedUnit === number);
      if (this._selectedUnit === number)
        element.setAttribute('aria-current', 'true');
      else element.removeAttribute('aria-current');
    });
  }
  private setTabStops() {
    if (!this.unitElements.some((unit) => unit.number === this.activeUnit))
      this.activeUnit = this.unitElements[0]?.number;
    this.unitElements.forEach((unit) =>
      unit.element.setAttribute(
        'tabindex',
        unit.number === this.activeUnit ? '0' : '-1'
      )
    );
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
      for (const cls of this.appliedClasses.get(unitId) ?? [])
        element.classList.remove(cls);

      // set class if defined
      const next = (cls ?? '').split(/\s+/).filter(Boolean);
      next.forEach((value) => element.classList.add(value));
      this.appliedClasses.set(unitId, next);
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
