import {
  ChangeDetectionStrategy,
  Component,
  provideZoneChangeDetection,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SharedModule } from '../../shared.module';
import { DataSource } from '../../datasources';
import { Column } from '../../models/column.model';
import { CustomRowAction } from './crud-table.component';

type Row = { name: string };
class RowsSource extends DataSource<Row> {
  fail = false;
  requests = 0;
  protected override _fetch() {
    this.requests++;
    return this.fail
      ? throwError(() => new Error('private backend failure'))
      : of([{ name: 'Alice' }, { name: 'Bob' }]);
  }
}

@Component({
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [SharedModule],
  template: `<app-crud-table
    tableLabel="Membres"
    createLabel="Ajouter un membre"
    [columns]="columns"
    [dataSource]="source"
    [canCreate]="canCreate"
    [canEdit]="canCreate"
    [canDelete]="canCreate"
    [canSelect]="true"
    [rowActions]="actions"
    (edit)="edit($event)"
  />`,
})
class ListHarness {
  source = new RowsSource();
  canCreate = false;
  columns = [new Column('name', { label: 'Nom', canFilter: true })];
  actions = [
    new CustomRowAction<Row>('download', 'Exporter', 'Exporter', vi.fn()),
  ];
  edit = vi.fn();
}

describe('Contextual list controls and recovery', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListHarness, NoopAnimationsModule],
      providers: [provideZoneChangeDetection(), provideRouter([])],
    }).compileComponents();
  });

  async function setup() {
    const fixture = TestBed.createComponent(ListHarness);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('names the primary action while retaining its permission and edit event', async () => {
    const fixture = await setup();
    const create = fixture.nativeElement.querySelector(
      '.create-action'
    ) as HTMLButtonElement;
    expect(create.getAttribute('aria-label')).toBe('Ajouter un membre');
    expect(create.textContent).not.toContain('Ajouter un membre');
    expect(create.disabled).toBe(true);
    create.click();
    expect(fixture.componentInstance.edit).not.toHaveBeenCalled();
    fixture.componentInstance.canCreate = true;
    fixture.detectChanges();
    expect(create.disabled).toBe(false);
    create.click();
    expect(fixture.componentInstance.edit).toHaveBeenCalledWith(undefined);
  });

  it('names row controls, announces the selection and preserves disabled menu actions', async () => {
    const fixture = await setup();
    expect(
      fixture.nativeElement.querySelector('table').getAttribute('aria-label')
    ).toBe('Membres');
    const alice = fixture.nativeElement.querySelector(
      'input[aria-label="Sélectionner Alice"]'
    ) as HTMLInputElement;
    expect(alice).not.toBeNull();
    alice.click();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('.selection-count').textContent
    ).toContain('1 ligne sélectionnée');
    fixture.nativeElement
      .querySelector('button[aria-label="Actions pour Alice"]')
      .click();
    fixture.detectChanges();
    await fixture.whenStable();
    const edit = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[mat-menu-item]')
    ).find((button) => button.textContent?.includes('Modifier'));
    expect(edit?.disabled).toBe(true);
    expect(
      Array.from(document.querySelectorAll('[mat-menu-item]')).some((item) =>
        item.textContent?.includes('Exporter')
      )
    ).toBe(true);
  });

  it('clears an unmatched search from the empty-state action and restores rows', async () => {
    const fixture = await setup();
    fixture.nativeElement
      .querySelector('button[aria-label="Rechercher dans la liste"]')
      .click();
    fixture.detectChanges();
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector(
      'input[matInput]'
    ) as HTMLInputElement;
    expect(input.getAttribute('aria-label')).toContain('Nom');
    input.value = 'nobody';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'Aucun résultat pour cette recherche.'
    );
    const clear = Array.from(
      fixture.nativeElement.querySelectorAll('button')
    ).find(
      (button) =>
        (button as HTMLButtonElement).textContent?.trim() ===
        'Effacer la recherche'
    ) as HTMLButtonElement;
    clear.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('tr[mat-row]').length).toBe(
      2
    );
    expect(fixture.nativeElement.textContent).not.toContain(
      'Aucun résultat pour cette recherche.'
    );
  });

  it('recovers a failed fetch through retry without exposing backend details', async () => {
    const fixture = await setup();
    fixture.componentInstance.source.fail = true;
    fixture.componentInstance.source.load();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[role="alert"]').textContent
    ).toContain('Impossible de charger la liste.');
    expect(fixture.nativeElement.textContent).not.toContain(
      'private backend failure'
    );
    const before = fixture.componentInstance.source.requests;
    fixture.componentInstance.source.fail = false;
    const retry = Array.from(
      fixture.nativeElement.querySelectorAll('button')
    ).find(
      (button) =>
        (button as HTMLButtonElement).textContent?.trim() === 'Réessayer'
    ) as HTMLButtonElement;
    retry.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.source.requests).toBe(before + 1);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('tr[mat-row]').length).toBe(
      2
    );
  });
});
