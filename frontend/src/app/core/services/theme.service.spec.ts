import { TestBed } from "@angular/core/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeService } from "./theme.service";

describe("Theme preference", () => {
  let listener: ((event: MediaQueryListEvent) => void) | undefined;
  beforeEach(() => {
    localStorage.removeItem("asl-theme");
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: true,
        addEventListener: (_: string, callback: typeof listener) => {
          listener = callback;
        },
        removeEventListener: vi.fn(),
      })),
    );
    TestBed.configureTestingModule({});
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.removeItem("asl-theme");
    delete document.documentElement.dataset["theme"];
    delete document.documentElement.dataset["themePreference"];
    listener = undefined;
  });
  it("follows system changes until an explicit choice overrides them, and can return to system", () => {
    const theme = TestBed.inject(ThemeService);
    expect(theme.resolved()).toBe("dark");
    listener?.({ matches: false } as MediaQueryListEvent);
    expect(document.documentElement.dataset["theme"]).toBe("light");
    theme.setPreference("dark");
    expect(localStorage.getItem("asl-theme")).toBe("dark");
    listener?.({ matches: false } as MediaQueryListEvent);
    expect(theme.resolved()).toBe("dark");
    theme.setPreference("system");
    expect(theme.resolved()).toBe("light");
    expect(document.documentElement.dataset["themePreference"]).toBe("system");
  });
  it("restores a saved light choice even on a dark system", () => {
    localStorage.setItem("asl-theme", "light");
    expect(TestBed.inject(ThemeService).resolved()).toBe("light");
    expect(document.documentElement.dataset["theme"]).toBe("light");
  });
  it("remains usable when browser storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const theme = TestBed.inject(ThemeService);
    expect(theme.preference()).toBe("system");
    expect(() => theme.setPreference("light")).not.toThrow();
    expect(document.documentElement.dataset["theme"]).toBe("light");
  });
});
