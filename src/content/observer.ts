import { YouTubeScanner } from './scanner';

export class YouTubeObserver {
  private scanner: YouTubeScanner;
  private observer: MutationObserver | null = null;
  private debounceTimer: number | null = null;
  private isObserving: boolean = false;

  constructor(scanner: YouTubeScanner) {
    this.scanner = scanner;
  }

  /**
   * Starts observing YouTube DOM mutations and navigation events.
   */
  public start(): void {
    if (this.isObserving) return;

    // 1. Initial scan
    this.scanner.scan();

    // 2. Hydration passes: Catch elements after YouTube client-side hydration
    window.setTimeout(() => this.scanner.scan(), 300);
    window.setTimeout(() => this.scanner.scan(), 1000);
    window.setTimeout(() => this.scanner.scan(), 2500);

    // 3. Setup MutationObserver for dynamically loaded video cards
    this.observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });

    const targetNode = document.body || document.documentElement;

    this.observer.observe(targetNode, {
      childList: true,
      subtree: true,
    });

    // 4. Listen for YouTube SPA client-side page transitions
    window.addEventListener('yt-navigate-finish', this.handlePageNavigation);
    window.addEventListener('yt-page-data-updated', this.handlePageNavigation);

    this.isObserving = true;
  }

  /**
   * Disconnects observer and cleans up listeners.
   */
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
   * Batches DOM mutations using a 60ms debounce window.
   */
  private handleMutations(_mutations: MutationRecord[]): void {
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = window.setTimeout(() => {
      this.debounceTimer = null;
      this.scanner.scan();
    }, 60);
  }

  /**
   * Triggered when YouTube completes an internal SPA route transition.
   */
  private handlePageNavigation = (): void => {
    window.setTimeout(() => this.scanner.scan(), 200);
    window.setTimeout(() => this.scanner.scan(), 800);
  };
}
