import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { TourService } from './tour.service';
import { TourExampleComponent } from './tour-example.component';
import { Subject, finalize, takeUntil } from 'rxjs';

@Component({
  selector: 'app-tour',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, TourExampleComponent],
  templateUrl: './tour.component.html',
  styleUrls: ['./tour.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class TourComponent {
  readonly tour = inject(TourService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyed = inject(DestroyRef);
  private readonly detector = inject(ChangeDetectorRef);
  @ViewChild('chapterTitle') private heading?: ElementRef<HTMLElement>;
  readonly mode = signal('updates');
  readonly ids = signal<string[] | null>(null);
  readonly index = signal(0);
  readonly finished = signal(false);
  readonly saving = signal(false);
  readonly saveError = signal('');
  readonly chapters = computed(() =>
    (this.ids() ?? []).flatMap((id) => {
      const step = this.tour.state()?.steps?.find((s) => s.id === id);
      return step ? [step] : [];
    })
  );
  readonly current = computed(() => this.chapters()[this.index()]);
  private sessionGeneration = -1;
  private readonly flowChanged = new Subject<void>();
  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.mode.set(params.get('mode') === 'all' ? 'all' : 'updates');
      this.resetSession();
    });
    effect(() => {
      const generation = this.tour.generation(),
        state = this.tour.state();
      if (generation !== this.sessionGeneration) {
        this.sessionGeneration = generation;
        this.resetSession();
      }
      if (state && !this.tour.loading() && this.ids() === null) {
        const steps =
          this.mode() === 'all' ? (state.steps ?? []) : this.tour.pending();
        this.ids.set(steps.map((s) => s.id!));
      }
      if (this.index() >= this.chapters().length)
        this.index.set(Math.max(0, this.chapters().length - 1));
    });
  }
  previous() {
    if (!this.saving() && this.index() > 0) {
      this.index.update((i) => i - 1);
      this.saveError.set('');
      this.focusHeading();
    }
  }
  next() {
    const step = this.current();
    if (!step || this.saving()) return;
    this.saveError.set('');
    if ((step.seen_revision ?? 0) >= (step.revision ?? 1)) {
      this.advance();
      return;
    }
    this.saving.set(true);
    this.tour
      .seen(step)
      .pipe(
        takeUntilDestroyed(this.destroyed),
        takeUntil(this.flowChanged),
        finalize(() => this.saving.set(false))
      )
      .subscribe({
        next: () => this.advance(),
        error: (error) =>
          this.saveError.set(
            error.status === 409
              ? 'La visite a été mise à jour. Recharge le parcours pour continuer.'
              : 'Ta progression n’a pas pu être enregistrée. Réessaie ou reprends la visite plus tard.'
          ),
      });
  }
  private advance() {
    if (this.index() + 1 < this.chapters().length)
      this.index.update((i) => i + 1);
    else this.finished.set(true);
    this.focusHeading();
  }
  private resetSession() {
    this.flowChanged.next();
    this.ids.set(null);
    this.index.set(0);
    this.finished.set(false);
    this.saveError.set('');
  }
  private focusHeading() {
    this.detector.detectChanges();
    this.heading?.nativeElement.focus();
  }
}
