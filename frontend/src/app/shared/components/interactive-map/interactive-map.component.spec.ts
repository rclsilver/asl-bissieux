import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { InteractiveMapComponent } from './interactive-map.component';

describe('Interactive map after the Angular migration', () => {
  it('keeps a static map readable without pointer or keyboard actions and can restore interaction', async () => {
    await TestBed.configureTestingModule({
      declarations: [InteractiveMapComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(InteractiveMapComponent);
    fixture.componentRef.setInput('interactive', false);
    fixture.componentRef.setInput('unitClasses', { 1: 'payment-overpaid' });
    fixture.componentRef.setInput('selectedUnit', 1);
    fixture.componentRef.setInput('highlightedUnits', [1]);
    fixture.componentRef.setInput('hoverClass', 'hovered');
    fixture.detectChanges();
    const unit = fixture.nativeElement.querySelector('#unit-01') as SVGGElement;
    const svg = fixture.nativeElement.querySelector('svg');
    const selected: number[] = [];
    fixture.componentInstance.unitClick.subscribe((event) =>
      selected.push(event.unitId)
    );
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.hasAttribute('aria-description')).toBe(false);
    expect(
      fixture.nativeElement.querySelectorAll(
        '#units [tabindex], #units [role="button"]'
      )
    ).toHaveLength(0);
    expect(unit.getAttribute('aria-label')).toBe('Lot 1');
    expect(unit.getAttribute('focusable')).toBe('false');
    expect(unit.onfocus).toBeNull();
    expect(unit.onclick).toBeNull();
    expect(unit.classList.contains('payment-overpaid')).toBe(true);
    expect(unit.classList.contains('unit-selected')).toBe(false);
    expect(unit.classList.contains('unit-highlighted')).toBe(false);
    expect(unit.hasAttribute('aria-current')).toBe(false);
    unit.dispatchEvent(new MouseEvent('mouseenter'));
    unit.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    unit.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );
    unit.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', bubbles: true })
    );
    expect(unit.classList.contains('hovered')).toBe(false);
    expect(selected).toEqual([]);
    fixture.componentRef.setInput('interactive', true);
    fixture.detectChanges();
    expect(svg.getAttribute('role')).toBe('group');
    expect(unit.getAttribute('role')).toBe('button');
    expect(
      fixture.nativeElement.querySelectorAll('#units [tabindex="0"]')
    ).toHaveLength(1);
    unit.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(selected).toEqual([1]);
    unit.focus();
    expect(document.activeElement).toBe(unit);
    fixture.componentRef.setInput('interactive', false);
    fixture.detectChanges();
    expect(document.activeElement).not.toBe(unit);
    expect(unit.onfocus).toBeNull();
    expect(unit.onclick).toBeNull();
    expect(unit.classList.contains('unit-selected')).toBe(false);
    expect(unit.hasAttribute('tabindex')).toBe(false);
  });
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

  it('keeps payment classes, selection and highlights independent during an update', async () => {
    await TestBed.configureTestingModule({
      declarations: [InteractiveMapComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(InteractiveMapComponent);
    fixture.componentRef.setInput('unitClasses', { 1: 'payment-waiting' });
    fixture.componentRef.setInput('highlightedUnits', [1, 2]);
    fixture.componentRef.setInput('selectedUnit', 1);
    fixture.detectChanges();
    const unit = fixture.nativeElement.querySelector('#unit-01') as SVGGElement;
    expect(unit.classList.contains('unit-highlighted')).toBe(true);
    fixture.componentRef.setInput('unitClasses', { 1: 'payment-overpaid' });
    fixture.detectChanges();
    expect(unit.classList.contains('payment-waiting')).toBe(false);
    expect(unit.classList.contains('payment-overpaid')).toBe(true);
    expect(unit.classList.contains('unit-selected')).toBe(true);
    expect(unit.getAttribute('aria-current')).toBe('true');
    fixture.componentRef.setInput('highlightedUnits', []);
    fixture.detectChanges();
    expect(unit.classList.contains('unit-highlighted')).toBe(false);
    expect(unit.classList.contains('payment-overpaid')).toBe(true);
  });

  it('provides one tab stop with numeric arrow navigation and keyboard activation', async () => {
    await TestBed.configureTestingModule({
      declarations: [InteractiveMapComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(InteractiveMapComponent);
    fixture.detectChanges();
    const first = fixture.nativeElement.querySelector(
      '#unit-01'
    ) as SVGGElement;
    const second = fixture.nativeElement.querySelector(
      '#unit-02'
    ) as SVGGElement;
    expect(
      fixture.nativeElement.querySelectorAll('#units > g[tabindex="0"]').length
    ).toBe(1);
    expect(first.getAttribute('tabindex')).toBe('0');
    expect(first.getAttribute('role')).toBe('button');
    first.focus();
    first.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
    );
    expect(document.activeElement).toBe(second);
    expect(second.getAttribute('tabindex')).toBe('0');
    const selected: number[] = [];
    fixture.componentInstance.unitClick.subscribe((event) =>
      selected.push(event.unitId)
    );
    second.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );
    second.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', bubbles: true })
    );
    expect(selected).toEqual([2, 2]);
    second.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Home', bubbles: true })
    );
    expect(document.activeElement).toBe(first);
  });
});
