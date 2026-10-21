import { provideZoneChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { BehaviorSubject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthService } from 'src/app/core/services/auth.service';
import { UnitsModule } from '../../units.module';
import { UnitListComponent } from './unit-list.component';

describe('Directory quality lot destinations', () => {
  let http: HttpTestingController;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  beforeEach(async () => {
    params = new BehaviorSubject(convertToParamMap({ quality: 'no_member' }));
    await TestBed.configureTestingModule({
      imports: [UnitsModule, NoopAnimationsModule],
      providers: [
        provideZoneChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { queryParamMap: params } },
        { provide: AuthService, useValue: { allowed$: () => of(false) } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('applies the missing-member and nonpositive-share filters visibly without refetching unrelated records', () => {
    const f = TestBed.createComponent(UnitListComponent);
    f.detectChanges();
    http.expectOne('/api/unit').flush([
      {
        id: 'one',
        number: 1,
        address: 'Lot avec membre',
        share: 1,
        members: [{ id: 'owner' }],
      },
      {
        id: 'two',
        number: 2,
        address: 'Lot sans membre',
        share: 1,
        members: [],
      },
      {
        id: 'three',
        number: 3,
        address: 'Lot sans parts',
        share: 0,
        members: [{ id: 'owner' }],
      },
    ]);
    f.detectChanges();
    let table = f.nativeElement.querySelector('table');
    expect(table.textContent).toContain('Lot sans membre');
    expect(table.textContent).not.toContain('Lot avec membre');
    params.next(convertToParamMap({ quality: 'invalid_shares' }));
    f.detectChanges();
    table = f.nativeElement.querySelector('table');
    expect(table.textContent).toContain('Lot sans parts');
    expect(table.textContent).not.toContain('Lot sans membre');
    http.expectNone('/api/unit');
    params.next(convertToParamMap({ quality: 'unknown' }));
    f.detectChanges();
    expect(f.nativeElement.querySelector('table').textContent).toContain(
      'Lot avec membre'
    );
  });
});
