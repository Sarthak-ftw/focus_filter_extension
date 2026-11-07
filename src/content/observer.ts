import { YouTubeScanner } from './scanner';

export class YouTubeObserver {
  private scanner: YouTubeScanner;
  private observer: MutationObserver | null = null;
  private debounceTimer: number | null = null;
  private isObserving: boolean = false;
  private navigationTimers: number[] = [];

  constructor(scanner: YouTubeScanner) {
    this.scanner = scanner;
  }

  public start(): void {
    if (this.isObserving) return;

    // 1. Immediate initial scan
    this.scanner.scan();

    // 2. Initial staggered hydration passes for client-side populated titles
    this.scheduleStaggeredScans();

    // 3. MutationObserver — observes dynamic DOM insertions (infinite scroll, search results)
    this.observer = new MutationObserver((mutations) => {
      // Trigger scan whenever nodes are added to the DOM
      const hasAddedNodes = mutations.some((m) => m.addedNodes.length > 0);
      if (hasAddedNodes) {
        this.scheduleScan();
      }
    });

    const targetNode = document.body || document.documentElement;
    this.observer.observe(targetNode, {
      childList: true,
      subtree: true,
    });

    // 4. SPA navigation events (searching, clicking video, clicking home)
    window.addEventListener('yt-navigate-finish', this.handlePageNavigation);
    window.addEventListener('yt-page-data-updated', this.handlePageNavigation);
    window.addEventListener('popstate', this.handlePageNavigation);

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

    this.clearNavigationTimers();

    window.removeEventListener('yt-navigate-finish', this.handlePageNavigation);
    window.removeEventListener('yt-page-data-updated', this.handlePageNavigation);
    window.removeEventListener('popstate', this.handlePageNavigation);

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
   * Handles SPA page transitions (Home -> Search, Search -> Watch, etc.).
   * Runs multiple staggered checks to catch elements as they stream from the server.
   */
  private handlePageNavigation = (): void => {
    this.clearNavigationTimers();
    this.scheduleStaggeredScans();
  };

  private scheduleStaggeredScans(): void {
    const delays = [200, 600, 1200, 2200];
    delays.forEach((delay) => {
      const timer = window.setTimeout(() => {
        this.scanner.scan();
      }, delay);
      this.navigationTimers.push(timer);
    });
  }

  private clearNavigationTimers(): void {
    this.navigationTimers.forEach((t) => window.clearTimeout(t));
    this.navigationTimers = [];
  }
}
