import { Component, Input } from '@angular/core';
import { Candidat } from 'src/app/models/candidat.model';

@Component({
  selector: 'app-candidat-view',
  templateUrl: './candidat-view.component.html',
  styleUrls: ['./candidat-view.component.scss'],
})
export class CandidatViewComponent {
  @Input() candidat?: Candidat;
  constructor() {}
}
