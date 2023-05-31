import { Component, EventEmitter, Input, Output } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Component({
  selector: 'app-interactive-map',
  templateUrl: './interactive-map.component.svg',
  styleUrls: ['./interactive-map.component.scss'],
})
export class InteractiveMapComponent {
  private readonly svgWidth = 1871;
  private readonly svgHeight = 1459.47;

  @Output() unitClick = new EventEmitter<{ unit: number; event: MouseEvent }>();

  @Input() width = 1000;
  @Input() height = (this.width * this.svgHeight) / this.svgWidth;

  @Input() showNumbers = true;
  @Input() unitClasses: { [unitId: number]: string } = {};

  onHover(event: MouseEvent) {
    event.preventDefault();

    const target = event.target as HTMLElement;
    const id = (target.parentElement?.getAttribute('id') ?? '').replace(
      /unit-0?/,
      ''
    );

    if (id) {
      this.unitClick.emit({
        unit: +id,
        event: event,
      });
    }
  }
}
