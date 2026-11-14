import { DOCUMENT } from '@angular/common';
import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StaleBundleErrorHandler } from './stale-bundle-error-handler';

describe('StaleBundleErrorHandler', () => {
  let reload: ReturnType<typeof vi.fn>;
  let store: Map<string, string>;
  let handler: StaleBundleErrorHandler;
  beforeEach(() => {
    reload = vi.fn();
    store = new Map();
    const view = {
      location: { reload },
      sessionStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
      },
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: DOCUMENT, useValue: { defaultView: view } },
        { provide: ErrorHandler, useClass: StaleBundleErrorHandler },
      ],
    });
    handler = TestBed.inject(ErrorHandler) as StaleBundleErrorHandler;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  it('reloads once when a lazy chunk of a previous build is gone', () => {
    const error = new TypeError(
      'Failed to fetch dynamically imported module: https://example.invalid/chunk-AAA.js'
    );
    handler.handleError(error);
    expect(reload).toHaveBeenCalledTimes(1);
    handler.handleError(error);
    expect(reload).toHaveBeenCalledTimes(1);
  });
  it('does not reload for ordinary errors', () => {
    handler.handleError(new Error('boom'));
    expect(reload).not.toHaveBeenCalled();
  });
});
