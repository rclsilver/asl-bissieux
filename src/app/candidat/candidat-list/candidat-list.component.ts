import { Component, Input, OnInit } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Candidat } from 'src/app/models/candidat.model';
import { Position } from 'src/app/types/position.type';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-candidat-list',
  templateUrl: './candidat-list.component.html',
  styleUrls: ['./candidat-list.component.scss'],
})
export class CandidatListComponent implements OnInit {
  @Input() position?: Position;

  private _candidats$ = new BehaviorSubject<Candidat[]>([]);
  readonly candidats$ = this._candidats$.asObservable();

  ngOnInit(): void {
    this._candidats$.next(
      environment.candidats
        .filter((candidat) => candidat.positions.includes(this.position!))
        .sort((a, b) => {
          if (a.lastName < b.lastName) {
            return -1;
          } else if (b.lastName < a.lastName) {
            return 1;
          } else {
            if (a.firstName < b.firstName) {
              return -1;
            } else if (b.firstName < a.firstName) {
              return 1;
            } else {
              return 0;
            }
          }
        })
    );
  }
}
