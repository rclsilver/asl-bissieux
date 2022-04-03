import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Position } from 'src/app/types/position.type';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent {
  readonly positions = [Position.PRESIDENT, Position.VICE_PRESIDENT, Position.SECRETAIRE, Position.TRESORIER];
  currentPosition: Position = Position.PRESIDENT;

  constructor(private route: ActivatedRoute) {
    this.route.params.subscribe((params) => {
      if (params.position) {
        if (params.position) {
          if (params.position.toLowerCase() === 'président') {
            this.currentPosition = Position.PRESIDENT;
          } else if (params.position.toLowerCase() === 'vice-président') {
            this.currentPosition = Position.VICE_PRESIDENT;
          } else if (params.position.toLowerCase() === 'trésorier') {
            this.currentPosition = Position.TRESORIER;
          } else if (params.position.toLowerCase() === 'secrétaire') {
            this.currentPosition = Position.SECRETAIRE;
          }
        }
      }
    });
  }
}
