import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { TourService } from './tour.service';

@Component({
  selector: 'app-tour-prompt',
  standalone: true,
  imports: [RouterLink, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `@if (tour.offer() && !router.url.startsWith('/tour')) {
    <section aria-label="Visite guidée" class="tour-invitation">
      <div>
        <strong>{{
          tour.state()?.seen_version
            ? 'Du nouveau à découvrir'
            : 'Bienvenue dans votre espace ASL'
        }}</strong>
        <p>
          {{
            tour.state()?.seen_version
              ? tour.pending().length +
                ' étape(s) nouvelle(s) ou mise(s) à jour, selon tes droits.'
              : 'Prends tes repères avec des exemples fictifs, à ton rythme.'
          }}
        </p>
      </div>
      <a
        mat-flat-button
        routerLink="/tour"
        [queryParams]="{ mode: 'updates' }"
        >{{
          tour.state()?.seen_version
            ? 'Voir les nouveautés'
            : 'Découvrir le site'
        }}</a
      >
      <button mat-button type="button" (click)="tour.dismiss()">
        Plus tard
      </button>
    </section>
  }`,
  styles: [
    `
      .tour-invitation {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.75rem;
        padding: 1rem 1.25rem;
        margin-block-end: 1.5rem;
        background: var(--asl-surface);
        border: 1px solid var(--asl-border);
        border-radius: var(--asl-radius);
      }
      .tour-invitation div {
        flex: 1;
        min-inline-size: min(100%, 16rem);
      }
      p {
        margin: 0.25rem 0 0;
        color: var(--asl-muted);
        line-height: 1.5;
      }
      a,
      button {
        min-block-size: 44px;
      }
    `,
  ],
})
export class TourPromptComponent {
  readonly tour = inject(TourService);
  readonly router = inject(Router);
}
