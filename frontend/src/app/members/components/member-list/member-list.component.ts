import {
  Component,
  inject,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ElementRef,
  ViewChild,
  OnInit,
  OnDestroy,
} from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { FormControl } from "@angular/forms";
import { Subject, takeUntil } from "rxjs";
import { APISchemas } from "src/app/core/api/openapi";
import { ApiService } from "src/app/core/services/api.service";
import { AuthService } from "src/app/core/services/auth.service";
import { NotificationDialogLevel } from "src/app/shared/components/notification-dialog/notification-dialog.component";
import { Column } from "src/app/shared/models/column.model";
import { NotificationsService } from "src/app/shared/services/notifications.service";
import { MemberDataSource } from "../../datasources/member.datasource";
import { MemberFormComponent } from "../member-form/member-form.component";
import { CustomRowAction } from "src/app/shared/components/crud-table/crud-table.component";
import {
  memberName,
  memberOwnsUnit,
  sortedMemberUnits,
} from "../../member-directory";

@Component({
  selector: "app-member-list",
  templateUrl: "./member-list.component.html",
  styleUrls: ["./member-list.component.scss"],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class MemberListComponent implements OnInit, OnDestroy {
  private readonly _api = inject(ApiService);
  private readonly _auth = inject(AuthService);
  private readonly _notifications = inject(NotificationsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly detector = inject(ChangeDetectorRef);
  private readonly destroyed$ = new Subject<void>();
  @ViewChild("selectionHeading", { static: true })
  private selectionHeading!: ElementRef<HTMLElement>;
  readonly query = new FormControl("", { nonNullable: true });
  readonly memberName = memberName;
  readonly memberUnits = sortedMemberUnits;
  readonly searchFields = [
    new Column("directory", { label: "Nom, coordonnées, adresse ou lot" }),
  ];
  view: "list" | "map" = "list";
  members: APISchemas["ModelsMember"][] = [];
  filteredMembers: APISchemas["ModelsMember"][] = [];
  private allUnits: APISchemas["ModelsUnit"][] = [];
  loading = true;
  loaded = false;
  error = false;
  unitsError = false;
  unitsLoading = false;
  selectedMemberId: string | null = null;
  selectedUnitNumber: number | null = null;
  private invalidSelection = false;
  readonly rowActions = [
    new CustomRowAction<APISchemas["ModelsMember"]>(
      "contact_page",
      "Consulter le membre et ses lots",
      "Consulter",
      (member) => this.selectMember(member),
    ),
  ];

  ngOnInit() {
    this.datasource.allResults$
      .pipe(takeUntil(this.destroyed$))
      .subscribe((members) => (this.members = members));
    this.datasource.results$
      .pipe(takeUntil(this.destroyed$))
      .subscribe((members) => (this.filteredMembers = members));
    this.datasource.units$
      .pipe(takeUntil(this.destroyed$))
      .subscribe((units) => (this.allUnits = units));
    this.datasource.loading$
      .pipe(takeUntil(this.destroyed$))
      .subscribe((loading) => (this.loading = loading));
    this.datasource.loaded$
      .pipe(takeUntil(this.destroyed$))
      .subscribe((loaded) => (this.loaded = loaded));
    this.datasource.error$
      .pipe(takeUntil(this.destroyed$))
      .subscribe((error) => (this.error = !!error));
    this.datasource.unitsError$
      .pipe(takeUntil(this.destroyed$))
      .subscribe((error) => (this.unitsError = !!error));
    this.datasource.unitsLoading$
      .pipe(takeUntil(this.destroyed$))
      .subscribe((loading) => (this.unitsLoading = loading));
    this.query.valueChanges
      .pipe(takeUntil(this.destroyed$))
      .subscribe((query) => {
        this.datasource.setQuery(query);
        this.selectedMemberId = null;
        this.selectedUnitNumber = null;
        this.invalidSelection = false;
        this.syncRoute(true);
      });
    this.route.queryParamMap
      .pipe(takeUntil(this.destroyed$))
      .subscribe((params) => {
        this.view = params.get("view") === "map" ? "map" : "list";
        const lot = params.get("lot");
        this.invalidSelection =
          lot !== null &&
          (!/^\d+$/.test(lot) || !Number.isSafeInteger(Number(lot)));
        this.selectedUnitNumber =
          lot !== null && !this.invalidSelection ? Number(lot) : null;
        this.selectedMemberId = lot === null ? params.get("member") : null;
      });
    this.datasource.load();
  }
  ngOnDestroy() {
    this.destroyed$.next();
    this.destroyed$.complete();
  }
  get directoryUnits() {
    if (!this.unitsError) return this.allUnits;
    const units = new Map<string | number, APISchemas["ModelsUnit"]>();
    for (const member of this.members)
      for (const unit of member.units ?? [])
        if (unit.id || unit.number !== undefined)
          units.set(unit.id ?? unit.number!, unit);
    return [...units.values()].sort(
      (a, b) => (a.number ?? 0) - (b.number ?? 0),
    );
  }
  get selectedMember() {
    return this.members.find((member) => member.id === this.selectedMemberId);
  }
  get selectedUnit() {
    return this.directoryUnits.find(
      (unit) => unit.number === this.selectedUnitNumber,
    );
  }
  get selectionMembers() {
    const unit = this.selectedUnit;
    return unit
      ? this.members.filter((member) => memberOwnsUnit(member, unit))
      : this.selectedMember
        ? [this.selectedMember]
        : [];
  }
  get highlightedUnits(): number[] {
    const units = this.selectedMember
      ? (this.selectedMember.units ?? [])
      : this.selectedUnit
        ? [this.selectedUnit]
        : [];
    return [
      ...new Set(
        units.flatMap((unit) =>
          unit.number === undefined ? [] : [unit.number],
        ),
      ),
    ];
  }
  get selectionError() {
    if (!this.loaded || this.loading || this.error) return "";
    if (this.invalidSelection)
      return "Le lien contient une sélection invalide. Choisis un membre ou un lot.";
    if (this.selectedMemberId && !this.selectedMember)
      return "Ce membre n’est plus disponible. Choisis un autre membre.";
    if (this.selectedUnitNumber !== null && !this.selectedUnit)
      return this.unitsLoading
        ? "Chargement du lot sélectionné…"
        : this.unitsError
          ? "Ce lot n’est pas disponible dans les données chargées. Réessaie le chargement des lots."
          : "Ce lot n’est pas renseigné ou n’est plus disponible.";
    return "";
  }
  setView(view: string) {
    this.view = view === "map" ? "map" : "list";
    this.syncRoute();
  }
  selectMember(member: APISchemas["ModelsMember"]) {
    if (!member.id) return;
    this.view = "map";
    this.selectedMemberId = member.id;
    this.selectedUnitNumber = null;
    this.invalidSelection = false;
    this.syncRoute();
    this.focusSelection();
  }
  selectUnit(number: number | undefined) {
    if (number === undefined || !Number.isSafeInteger(number) || number < 0)
      return;
    this.view = "map";
    this.selectedUnitNumber = number;
    this.selectedMemberId = null;
    this.invalidSelection = false;
    this.syncRoute();
    this.focusSelection();
  }
  clearSelection() {
    this.selectedMemberId = null;
    this.selectedUnitNumber = null;
    this.invalidSelection = false;
    this.syncRoute();
    this.focusSelection();
  }
  private syncRoute(replaceUrl = false) {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParamsHandling: "merge",
      replaceUrl,
      queryParams: {
        view: this.view === "map" ? "map" : null,
        member: this.selectedMemberId,
        lot: this.selectedUnitNumber,
      },
    });
  }
  private focusSelection() {
    this.detector.detectChanges();
    this.selectionHeading.nativeElement.focus();
  }

  readonly columns = [
    new Column("first_name", {
      label: "Prénom",
      canSort: true,
      sortFunc: (a, b) =>
        String(a ?? "").localeCompare(String(b ?? ""), "fr", {
          sensitivity: "base",
        }),
      canFilter: false,
    }),
    new Column("last_name", {
      label: "Nom",
      canSort: true,
      defaultSort: true,
      sortFunc: (a, b) =>
        String(a ?? "").localeCompare(String(b ?? ""), "fr", {
          sensitivity: "base",
        }),
      canFilter: false,
    }),
    new Column("address", {
      label: "Adresse",
      canFilter: false,
    }),
    new Column("phone_number", {
      label: "Téléphone",
      canFilter: false,
    }),
    new Column("email", {
      label: "E-mail",
      canFilter: false,
    }),
    new Column<APISchemas["ModelsUnit"][]>("units", {
      label: "Lots",
      render: (units) => (units ?? []).map((unit) => unit.number).join(", "),
      canSort: true,
      sortFunc: (a, b) => {
        const first = Math.min(...(a ?? []).map((unit) => unit.number ?? 0));
        const second = Math.min(...(b ?? []).map((unit) => unit.number ?? 0));
        return first === second ? 0 : first < second ? -1 : 1;
      },
      canFilter: false,
      filterFunc: (units, pattern) => {
        if (!pattern) {
          return true;
        }

        for (let unit of units) {
          if ((unit.number ?? 0).toString().indexOf(pattern) !== -1) {
            return true;
          }
        }

        return false;
      },
    }),
  ];
  readonly rowLabel = (member: APISchemas["ModelsMember"]) =>
    [member.first_name, member.last_name].filter(Boolean).join(" ");
  readonly datasource = new MemberDataSource();

  readonly canCreate$ = this._auth.allowed$("member.CreateMember");

  refresh() {
    if (!this.loading && !this.unitsLoading) this.datasource.load();
  }

  canEdit(_: APISchemas["ModelsMember"]) {
    return this._auth.allowed$("member.UpdateMember");
  }

  canDelete(_: APISchemas["ModelsMember"]) {
    return this._auth.allowed$("member.DeleteMember");
  }

  edit(member?: APISchemas["ModelsMember"]) {
    this._notifications
      .showForm(MemberFormComponent, {
        data: {
          member,
        },
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.refresh();
        }
      });
  }

  delete(member: APISchemas["ModelsMember"]) {
    this._notifications
      .showConfirm({
        title: "Supprimer un membre",
        confirmLabel: "Supprimer",
        message: `Supprimer le membre ${member.first_name} ${member.last_name} ?`,
        class: "warn",
      })
      .afterClosed()
      .subscribe((confirm) => {
        if (confirm) {
          this._api.deleteMember(member.id!).subscribe({
            next: () => {
              this.refresh();
              this._notifications.showDialog({
                title: "Info",
                message: `Le membre ${member.first_name} ${member.last_name} a été supprimé.`,
                level: NotificationDialogLevel.Info,
              });
            },
            error: this._api.handleError("Impossible de supprimer le membre"),
          });
        }
      });
  }
}
