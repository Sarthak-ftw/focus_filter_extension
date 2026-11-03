import { FilterEngine } from '../filtering/engine';
import { YOUTUBE_SELECTORS } from './selectors';
import { ThumbnailScanner } from './thumbnail-scanner';

const PROCESSED_ATTR = 'data-focus-filter-processed';
const HIDDEN_ATTR = 'data-focus-filter-hidden';

export class YouTubeScanner {
  private engine: FilterEngine;
  private thumbnailScanner?: ThumbnailScanner;
  private onCountIncrement?: (count: number) => void;
  private sessionHiddenCount: number = 0;

  constructor(
    engine: FilterEngine,
    thumbnailScanner?: ThumbnailScanner,
    onCountIncrement?: (count: number) => void
  ) {
    this.engine = engine;
    this.thumbnailScanner = thumbnailScanner;
    this.onCountIncrement = onCountIncrement;
  }

  public setThumbnailScanner(scanner: ThumbnailScanner): void {
    this.thumbnailScanner = scanner;
  }

  /**
   * Scans a given root DOM element (or document) and applies filtering rules.
   */
  public scan(root: ParentNode = document): number {
    let newlyHidden = 0;

    // 1. Scan individual video cards
    const cards = root.querySelectorAll<HTMLElement>(YOUTUBE_SELECTORS.cards);
    const visibleCards: HTMLElement[] = [];

    cards.forEach((card) => {
      // Skip if already processed and rules haven't changed
      if (card.hasAttribute(PROCESSED_ATTR)) {
        if (!card.hasAttribute(HIDDEN_ATTR)) {
          visibleCards.push(card);
        }
        return;
      }

      const isHidden = this.processCard(card);
      if (isHidden) {
        newlyHidden++;
      } else {
        visibleCards.push(card);
      }
    });

    // Pass visible cards to the thumbnail OCR scanner
    if (visibleCards.length > 0 && this.thumbnailScanner) {
      this.thumbnailScanner.observeCards(visibleCards);
    }

    // 2. Scan Shorts shelves if applicable
    const shelves = root.querySelectorAll<HTMLElement>(YOUTUBE_SELECTORS.shortsShelves);
    shelves.forEach((shelf) => {
      if (shelf.hasAttribute(PROCESSED_ATTR)) return;

      const evalResult = this.engine.evaluate('Shorts Shelf', '', true);
      shelf.setAttribute(PROCESSED_ATTR, 'true');

      if (evalResult.shouldHide) {
        shelf.style.display = 'none';
        shelf.setAttribute(HIDDEN_ATTR, 'true');
        newlyHidden++;
      }
    });

    if (newlyHidden > 0 && this.onCountIncrement) {
      this.sessionHiddenCount += newlyHidden;
      this.onCountIncrement(this.sessionHiddenCount);
    }

    return newlyHidden;
  }

  /**
   * Evaluates and applies hiding logic to a single video card.
   */
  private processCard(card: HTMLElement): boolean {
    const title = this.extractTitle(card);
    const channel = this.extractChannel(card);
    const isShort =
      card.tagName.toLowerCase() === 'ytd-reel-item-renderer' ||
      !!card.querySelector('a[href*="/shorts/"]');

    const result = this.engine.evaluate(title, channel, isShort);

    // Tag as processed so we don't re-parse on every tick
    card.setAttribute(PROCESSED_ATTR, 'true');

    if (result.shouldHide) {
      // Hide completely without disrupting grid geometry
      card.style.display = 'none';
      card.setAttribute(HIDDEN_ATTR, 'true');
      card.setAttribute('data-focus-filter-reason', `${result.matchedType}: ${result.matchedKeyword}`);
      return true;
    } else {
      // Ensure visible if previously hidden
      if (card.hasAttribute(HIDDEN_ATTR)) {
        card.style.display = '';
        card.removeAttribute(HIDDEN_ATTR);
        card.removeAttribute('data-focus-filter-reason');
      }
      return false;
    }
  }

  /**
   * Re-evaluates every previously seen card.
   * Invoked whenever user updates settings or keywords in the popup.
   */
  public reEvaluateAll(): void {
    const allCards = document.querySelectorAll<HTMLElement>(
      `[${PROCESSED_ATTR}]`
    );

    let newlyHidden = 0;

    allCards.forEach((card) => {
      // Remove processed stamp to force re-evaluation
      card.removeAttribute(PROCESSED_ATTR);

      if (
        card.matches(YOUTUBE_SELECTORS.shortsShelves) ||
        card.tagName.toLowerCase().includes('shelf')
      ) {
        const evalResult = this.engine.evaluate('Shorts Shelf', '', true);
        card.setAttribute(PROCESSED_ATTR, 'true');
        if (evalResult.shouldHide) {
          card.style.display = 'none';
          card.setAttribute(HIDDEN_ATTR, 'true');
        } else {
          card.style.display = '';
          card.removeAttribute(HIDDEN_ATTR);
        }
      } else {
        const isHidden = this.processCard(card);
        if (isHidden) newlyHidden++;
      }
    });

    if (newlyHidden > 0 && this.onCountIncrement) {
      this.sessionHiddenCount += newlyHidden;
      this.onCountIncrement(this.sessionHiddenCount);
    }
  }

  private extractTitle(card: HTMLElement): string {
    const titleEl = card.querySelector<HTMLElement>(YOUTUBE_SELECTORS.titles);
    if (!titleEl) return '';
    return (
      titleEl.getAttribute('title') ||
      titleEl.textContent ||
      titleEl.innerText ||
      ''
    ).trim();
  }

  private extractChannel(card: HTMLElement): string {
    const channelEl = card.querySelector<HTMLElement>(YOUTUBE_SELECTORS.channels);
    if (!channelEl) return '';
    return (channelEl.textContent || channelEl.innerText || '').trim();
  }
}
