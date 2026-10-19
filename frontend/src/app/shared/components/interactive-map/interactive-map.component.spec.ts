import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { InteractiveMapComponent } from './interactive-map.component';

describe('Interactive map after the Angular migration', () => {
  it('renders payment colors and labels, and emits the selected lot', async () => {
    await TestBed.configureTestingModule({
      declarations: [InteractiveMapComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(InteractiveMapComponent);
    fixture.componentRef.setInput('unitClasses', { 1: 'overpaid' });
    fixture.componentRef.setInput('showLabels', true);
    fixture.detectChanges();
    const unit = fixture.nativeElement.querySelector(
      '#units [id="unit-01"]'
    ) as SVGGElement;
    expect(unit).not.toBeNull();
    expect(unit.classList.contains('overpaid')).toBe(true);
    expect(
      unit.querySelector('[id^="label"]')?.classList.contains('hidden')
    ).toBe(false);
    let selected: number | undefined;
    fixture.componentInstance.unitClick.subscribe(
      (event) => (selected = event.unitId)
    );
    unit.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(selected).toBe(1);
  });
});
