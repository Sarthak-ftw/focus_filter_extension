import { YouTubeScanner } from './scanner';

export class YouTubeObserver {
  private scanner: YouTubeScanner;
  private observer: MutationObserver | null = null;
  private debounceTimer: number | null = null;
  private isObserving: boolean = false;

  // Track whether we have a pending initial hydration scan already scheduled
  private hydrationDone: boolean = false;

  constructor(scanner: YouTubeScanner) {
    this.scanner = scanner;
  }

  public start(): void {
    if (this.isObserving) return;

    // 1. Immediate first scan
    this.scanner.scan();

    // 2. Single deferred hydration pass — catches YouTube's client-side populated titles.
    //    We only do this once; the MutationObserver handles subsequent dynamic loads.
    if (!this.hydrationDone) {
      this.hydrationDone = true;
      window.setTimeout(() => this.scanner.scan(), 500);
    }

    // 3. MutationObserver — only watches childList additions, not attribute changes
    //    to avoid reacting to our own attribute writes (processed, hidden, blurred).
    this.observer = new MutationObserver((mutations) => {
      // Filter to only batches that add new DOM nodes (new video cards loaded)
      const hasNewNodes = mutations.some((m) => m.addedNodes.length > 0);
      if (hasNewNodes) {
        this.scheduleScan();
      }
    });

    const targetNode = document.body || document.documentElement;
    this.observer.observe(targetNode, {
      childList: true,
      subtree: true,
    });

    // 4. SPA navigation events
    window.addEventListener('yt-navigate-finish', this.handlePageNavigation);
    window.addEventListener('yt-page-data-updated', this.handlePageNavigation);

    this.isObserving = true;
  }

  public stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    window.removeEventListener('yt-navigate-finish', this.handlePageNavigation);
    window.removeEventListener('yt-page-data-updated', this.handlePageNavigation);

    this.isObserving = false;
  }

  /**
   * Debounced scan scheduler.
   * Collapses multiple rapid mutations (e.g., 20 cards loading at once)
   * into a single scan after a 120ms quiet window.
   */
  private scheduleScan(): void {
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = window.setTimeout(() => {
      this.debounceTimer = null;
      this.scanner.scan();
    }, 120);
  }

  /**
   * SPA page navigation — wait for YouTube to mount the new page content.
   */
  private handlePageNavigation = (): void => {
    this.hydrationDone = false;
    window.setTimeout(() => {
      this.scanner.scan();
      this.hydrationDone = true;
    }, 400);
  };
}
