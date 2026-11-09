import { DOCUMENT } from '@angular/common';
import { ErrorHandler, Injectable, inject } from '@angular/core';

const RELOAD_KEY = 'asl.stale-bundle-reload';
const RELOAD_WINDOW_MS = 60_000;
const STALE_BUNDLE =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Loading chunk [^ ]+ failed|Importing a module script failed/i;

/**
 * After a deployment the lazy-loaded chunks of the previous build no longer
 * exist, so a tab opened before the release fails to navigate. Reload once to
 * pick up the new build; a recent reload is never repeated, to avoid loops.
 */
@Injectable()
export class StaleBundleErrorHandler extends ErrorHandler {
  private document = inject(DOCUMENT);

  override handleError(error: unknown): void {
    if (this.isStaleBundle(error) && this.reloadOnce()) return;
    super.handleError(error);
  }

  private isStaleBundle(error: unknown): boolean {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : ((error as { message?: string } | null)?.message ?? '');
    return STALE_BUNDLE.test(message);
  }

  private reloadOnce(): boolean {
    const view = this.document.defaultView;
    if (!view) return false;
    try {
      const last = Number(view.sessionStorage.getItem(RELOAD_KEY) ?? 0);
      if (Date.now() - last < RELOAD_WINDOW_MS) return false;
      view.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    } catch {
      return false;
    }
    view.location.reload();
    return true;
  }
}
