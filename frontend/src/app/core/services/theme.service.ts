import { DOCUMENT } from "@angular/common";
import {
  DestroyRef,
  Injectable,
  computed,
  inject,
  signal,
} from "@angular/core";

export type ThemePreference = "system" | "light" | "dark";
const STORAGE_KEY = "asl-theme";

@Injectable({ providedIn: "root" })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly window = this.document.defaultView;
  private readonly media = this.window?.matchMedia?.(
    "(prefers-color-scheme: dark)",
  );
  private readonly systemDark = signal(this.media?.matches ?? false);
  private readonly choice = signal<ThemePreference>(this.readPreference());
  readonly preference = this.choice.asReadonly();
  readonly resolved = computed(() =>
    this.choice() === "system"
      ? this.systemDark()
        ? "dark"
        : "light"
      : this.choice(),
  );

  constructor() {
    const update = (event: MediaQueryListEvent) => {
      this.systemDark.set(event.matches);
      this.apply();
    };
    this.media?.addEventListener("change", update);
    inject(DestroyRef).onDestroy(() =>
      this.media?.removeEventListener("change", update),
    );
    this.apply();
  }

  setPreference(preference: ThemePreference) {
    this.choice.set(preference);
    try {
      this.window?.localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      /* Private storage may be unavailable. */
    }
    this.apply();
  }

  private readPreference(): ThemePreference {
    try {
      const value = this.window?.localStorage.getItem(STORAGE_KEY);
      if (value === "light" || value === "dark") return value;
    } catch {
      /* The system preference remains usable without storage. */
    }
    return "system";
  }

  private apply() {
    this.document.documentElement.dataset["theme"] = this.resolved();
    this.document.documentElement.dataset["themePreference"] =
      this.preference();
  }
}
