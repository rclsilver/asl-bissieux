import { provideZoneChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import {
  ActivatedRoute,
  Router,
  convertToParamMap,
  provideRouter,
} from "@angular/router";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { BehaviorSubject, of } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthService } from "src/app/core/services/auth.service";
import { NotificationsService } from "src/app/shared/services/notifications.service";
import { MembersModule } from "../../members.module";
import { MemberListComponent } from "./member-list.component";

const one = { id: "unit-one", number: 1, address: "Allée du Chêne" };
const two = { id: "unit-two", number: 2, address: "Deuxième rue" };
const empty = { id: "unit-three", number: 3, address: "" };
const elodie = {
  id: "member-elodie",
  first_name: "Élodie",
  last_name: "Cœur-Dupont",
  email: "elodie@example.invalid",
  units: [one, two],
};
const bob = {
  id: "member-bob",
  first_name: "Bob",
  last_name: "Copropriétaire",
  email: "",
  phone_number: "",
  units: [one],
};
const zoe = {
  id: "member-zoe",
  first_name: "Zoé",
  last_name: "Sans lot",
  units: [],
};
const members = [elodie, bob, zoe];
const units = [one, two, empty];

describe("Member directory and map", () => {
  let http: HttpTestingController;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let navigate: ReturnType<typeof vi.spyOn>;
  beforeEach(async () => {
    params = new BehaviorSubject(convertToParamMap({}));
    await TestBed.configureTestingModule({
      imports: [MembersModule, NoopAnimationsModule],
      providers: [
        provideZoneChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: params.asObservable() },
        },
        { provide: AuthService, useValue: { allowed$: () => of(false) } },
        {
          provide: NotificationsService,
          useValue: {
            showForm: vi.fn(),
            showConfirm: vi.fn(),
            showDialog: vi.fn(),
          },
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    navigate = vi
      .spyOn(TestBed.inject(Router), "navigate")
      .mockResolvedValue(true);
  });
  afterEach(() => http.verify());
  function setup(unitFailure = false) {
    const fixture = TestBed.createComponent(MemberListComponent);
    fixture.detectChanges();
    http.expectOne("/api/member").flush(members);
    if (unitFailure)
      http
        .expectOne("/api/unit")
        .flush({}, { status: 503, statusText: "Unavailable" });
    else http.expectOne("/api/unit").flush(units);
    fixture.detectChanges();
    return fixture;
  }

  it("applies the missing-email link filter while retaining full member and coowner context", () => {
    params.next(convertToParamMap({ quality: "missing_email" }));
    const fixture = setup();
    const page = fixture.componentInstance;
    expect(page.quality).toBe("missing_email");
    expect(page.filteredMembers.map((m) => m.id)).toEqual([bob.id, zoe.id]);
    expect(page.members).toHaveLength(3);
    page.query.setValue("Bob");
    expect(page.filteredMembers.map((m) => m.id)).toEqual([bob.id]);
    params.next(convertToParamMap({}));
    page.query.setValue("");
    expect(page.filteredMembers).toHaveLength(3);
    const allowed = vi.spyOn(TestBed.inject(AuthService), "allowed$");
    page.canEdit(bob);
    expect(allowed).toHaveBeenCalledWith("member.UpdateMember");
  });
  it("shares accent-insensitive search across views without reloading or disconnecting the table", () => {
    const fixture = setup();
    const page = fixture.componentInstance;
    const table = fixture.nativeElement.querySelector("table");
    page.query.setValue("coeur ELODIE");
    fixture.detectChanges();
    expect(page.filteredMembers.map((member) => member.id)).toEqual([
      elodie.id,
    ]);
    expect(page.highlightedUnits).toEqual([1, 2]);
    page.setView("map");
    fixture.detectChanges();
    const header = fixture.nativeElement.querySelector(
      "app-crud-table mat-toolbar",
    );
    expect(header.querySelector('input[type="search"]')).not.toBeNull();
    expect(header.querySelector("mat-select")).not.toBeNull();
    expect(header.querySelector("mat-button-toggle-group")).not.toBeNull();
    expect(header.querySelector(".create-action")).not.toBeNull();
    expect(fixture.nativeElement.querySelector(".table-container").hidden).toBe(
      true,
    );
    page.setView("list");
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector(".table-container").hidden).toBe(
      false,
    );
    expect(page.query.value).toBe("coeur ELODIE");
    expect(fixture.nativeElement.querySelector("table")).toBe(table);
    expect(page.filteredMembers).toHaveLength(1);
    http.expectNone("/api/member");
    http.expectNone("/api/unit");
    expect(navigate).toHaveBeenCalled();
    expect(
      JSON.stringify(
        navigate.mock.calls.map(
          (call: Parameters<Router["navigate"]>) => call[1]?.queryParams,
        ),
      ),
    ).not.toContain("ELODIE");
    expect(fixture.nativeElement.querySelector(".create-action").disabled).toBe(
      true,
    );
  });

  it("shows all coowners of a lot even when only one matches and focuses the details", () => {
    const fixture = setup();
    const page = fixture.componentInstance;
    page.query.setValue("elodie");
    page.selectUnit(1);
    fixture.detectChanges();
    expect(new Set(page.selectionMembers.map((member) => member.id))).toEqual(
      new Set([bob.id, elodie.id]),
    );
    expect(
      fixture.nativeElement.querySelector(".selection-pane").textContent,
    ).toContain("Non renseigné");
    expect(document.activeElement).toBe(
      fixture.nativeElement.querySelector(".selection-pane h3"),
    );
    page.selectMember(elodie);
    fixture.detectChanges();
    expect(page.highlightedUnits).toEqual([1, 2]);
    page.selectMember(zoe);
    fixture.detectChanges();
    expect(page.highlightedUnits).toEqual([]);
    expect(
      fixture.nativeElement.querySelector(".selection-pane").textContent,
    ).toContain("Aucun lot associé");
    page.clearSelection();
    expect(document.activeElement).toBe(
      fixture.nativeElement.querySelector('input[type="search"]'),
    );
  });

  it("resolves budget links by lot number, handles unassigned and missing lots and gives lot precedence", () => {
    params.next(convertToParamMap({ view: "map", lot: "1", member: zoe.id }));
    const fixture = setup();
    const page = fixture.componentInstance;
    expect(page.view).toBe("map");
    expect(page.selectedUnit?.id).toBe(one.id);
    expect(page.selectedMember).toBeUndefined();
    page.selectUnit(3);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector(".selection-pane").textContent,
    ).toContain("Aucun membre");
    params.next(convertToParamMap({ view: "map", lot: "999" }));
    fixture.detectChanges();
    expect(page.selectionError).toContain("plus disponible");
    params.next(convertToParamMap({ view: "map", lot: "bad" }));
    fixture.detectChanges();
    expect(page.selectionError).toContain("invalide");
    params.next(convertToParamMap({ view: "map", member: "deleted-member" }));
    fixture.detectChanges();
    expect(page.selectionError).toContain("Ce membre");
  });

  it("keeps the directory and assigned lots available after a units-only failure and retries only units", () => {
    const fixture = setup(true);
    const page = fixture.componentInstance;
    expect(page.error).toBe(false);
    expect(page.unitsError).toBe(true);
    expect(page.members).toHaveLength(3);
    expect(page.directoryUnits.map((unit) => unit.number)).toEqual([1, 2]);
    page.selectMember(elodie);
    expect(page.selectionMembers).toEqual([elodie]);
    page.selectUnit(1);
    page.datasource.retryUnits();
    fixture.detectChanges();
    expect(page.unitsLoading).toBe(true);
    expect(page.directoryUnits.map((unit) => unit.number)).toEqual([1, 2]);
    expect(page.selectionMembers).toHaveLength(2);
    expect(page.selectionError).toBe("");
    page.refresh();
    http.expectNone("/api/member");
    http
      .expectOne("/api/unit")
      .flush({}, { status: 503, statusText: "Unavailable" });
    fixture.detectChanges();
    expect(page.unitsError).toBe(true);
    expect(page.selectionMembers).toHaveLength(2);
    page.datasource.retryUnits();
    http.expectOne("/api/unit").flush(units);
    fixture.detectChanges();
    expect(page.unitsError).toBe(false);
    expect(page.directoryUnits).toHaveLength(3);
  });

  it("clears sensitive results after a member load failure and can recover without losing search", () => {
    const fixture = setup();
    const page = fixture.componentInstance;
    page.query.setValue("zoe");
    page.refresh();
    http.expectOne("/api/unit").flush(units);
    http
      .expectOne("/api/member")
      .flush({}, { status: 403, statusText: "Forbidden" });
    fixture.detectChanges();
    expect(page.error).toBe(true);
    expect(page.members).toEqual([]);
    expect(page.selectionMembers).toEqual([]);
    page.refresh();
    http.expectOne("/api/member").flush(members);
    http.expectOne("/api/unit").flush(units);
    fixture.detectChanges();
    expect(page.error).toBe(false);
    expect(page.filteredMembers.map((member) => member.id)).toEqual([zoe.id]);
    expect(page.query.value).toBe("zoe");
  });
});
