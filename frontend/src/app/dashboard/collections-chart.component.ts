import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { APISchemas } from '../core/api/openapi';

@Component({
  selector: 'app-collections-chart',
  standalone: false,
  templateUrl: './collections-chart.component.html',
  styleUrls: ['./collections-chart.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class CollectionsChartComponent {
  @Input() months: APISchemas['ModelsMonthlyCollection'][] = [];
  @Input() called = 0;
  @Input() year = 0;
  get chartBounds() {
    const values = this.months.map((m) => m.cumulative ?? 0);
    return {
      min: Math.min(0, ...values),
      max: Math.max(1, this.called, ...values),
    };
  }
  y(value: number) {
    const { min, max } = this.chartBounds;
    return 250 - ((value - min) / (max - min)) * 210;
  }
  get chartPoints() {
    return [
      `40,${this.y(0)}`,
      ...this.months.map(
        (m, i) => `${40 + (i + 1) * 50},${this.y(m.cumulative ?? 0)}`
      ),
    ].join(' ');
  }
  axis(value: number) {
    return (
      new Intl.NumberFormat('fr-FR', {
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(value) + ' €'
    );
  }
}
