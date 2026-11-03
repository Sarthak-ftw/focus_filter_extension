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

    // 1. Initial scan of the current page
    this.scanner.scan();

    // 2. Setup MutationObserver for dynamically loaded video cards
    this.observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });

    const targetNode = document.body || document.documentElement;

    this.observer.observe(targetNode, {
      childList: true,
      subtree: true,
    });

    // 3. Listen for YouTube SPA client-side page transitions
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
   * Prevents layout thrashing and UI jank during rapid scrolling.
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
    // Delay slightly to let YouTube mount the new view's primary container
    window.setTimeout(() => {
      this.scanner.scan();
    }, 200);
  };
}
