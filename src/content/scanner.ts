import { FilterEngine } from '../filtering/engine';
import { YOUTUBE_SELECTORS } from './selectors';
import { ThumbnailScanner } from './thumbnail-scanner';
import { FilterStyle } from '../types';

const PROCESSED_ATTR = 'data-focus-filter-processed';
const HIDDEN_ATTR = 'data-focus-filter-hidden';
const REVEALED_ATTR = 'data-focus-filter-revealed';
const OVERLAY_CLASS = 'focus-filter-reveal-overlay';

export class YouTubeScanner {
  private engine: FilterEngine;
  private thumbnailScanner?: ThumbnailScanner;
  private filterStyle: FilterStyle = 'blur';
  private onCountIncrement?: (count: number) => void;
  private sessionHiddenCount: number = 0;

  constructor(
    engine: FilterEngine,
    thumbnailScanner?: ThumbnailScanner,
    filterStyle: FilterStyle = 'blur',
    onCountIncrement?: (count: number) => void
  ) {
    this.engine = engine;
    this.thumbnailScanner = thumbnailScanner;
    this.filterStyle = filterStyle;
    this.onCountIncrement = onCountIncrement;
  }

  public setFilterStyle(style: FilterStyle): void {
    this.filterStyle = style;
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
   * Evaluates and applies hiding or blurring logic to a single video card.
   */
  private processCard(card: HTMLElement): boolean {
    // If the user intentionally revealed this card during this session, leave it visible
    if (card.hasAttribute(REVEALED_ATTR)) {
      return false;
    }

    const title = this.extractTitle(card);
    const channel = this.extractChannel(card);
    const isShort =
      card.tagName.toLowerCase() === 'ytd-reel-item-renderer' ||
      !!card.querySelector('a[href*="/shorts/"]');

    const result = this.engine.evaluate(title, channel, isShort);

    // Tag as processed so we don't re-parse on every tick
    card.setAttribute(PROCESSED_ATTR, 'true');

    if (result.shouldHide) {
      card.setAttribute(HIDDEN_ATTR, 'true');
      card.setAttribute(
        'data-focus-filter-reason',
        `${result.matchedType}: ${result.matchedKeyword}`
      );

      if (this.filterStyle === 'hide') {
        this.removeRevealOverlay(card);
        card.style.display = 'none';
        card.style.filter = '';
        card.style.opacity = '';
      } else {
        // Blur style with reveal overlay
        card.style.display = '';
        card.style.filter = 'blur(10px) grayscale(85%)';
        card.style.opacity = '0.4';
        card.style.transition = 'filter 0.25s ease, opacity 0.25s ease';
        this.attachRevealOverlay(card, result.matchedKeyword || 'Distraction');
      }

      return true;
    } else {
      // Ensure visible if previously hidden
      if (card.hasAttribute(HIDDEN_ATTR)) {
        this.restoreCard(card);
      }
      return false;
    }
  }

  private restoreCard(card: HTMLElement): void {
    card.style.display = '';
    card.style.filter = '';
    card.style.opacity = '';
    card.removeAttribute(HIDDEN_ATTR);
    card.removeAttribute('data-focus-filter-reason');
    this.removeRevealOverlay(card);
  }

  private attachRevealOverlay(card: HTMLElement, keyword: string): void {
    if (card.querySelector(`.${OVERLAY_CLASS}`)) return;

    card.style.position = 'relative';

    const overlay = document.createElement('div');
    overlay.className = OVERLAY_CLASS;
    overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(15, 23, 42, 0.45);
      backdrop-filter: blur(4px);
      z-index: 10;
      border-radius: 12px;
      padding: 12px;
      cursor: default;
    `;

    const label = document.createElement('span');
    label.textContent = `Filtered: "${keyword}"`;
    label.style.cssText = `
      font-size: 11px;
      font-weight: 600;
      color: #f1f5f9;
      background: rgba(0, 0, 0, 0.6);
      padding: 3px 8px;
      border-radius: 6px;
      margin-bottom: 8px;
      font-family: system-ui, -apple-system, sans-serif;
    `;

    const button = document.createElement('button');
    button.textContent = '👁️ Reveal Video';
    button.style.cssText = `
      font-size: 12px;
      font-weight: 600;
      color: #ffffff;
      background: #4f46e5;
      border: none;
      padding: 6px 14px;
      border-radius: 8px;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(79, 70, 229, 0.4);
      transition: transform 0.15s ease, background 0.15s ease;
      font-family: system-ui, -apple-system, sans-serif;
    `;

    button.onmouseenter = () => {
      button.style.background = '#4338ca';
      button.style.transform = 'scale(1.04)';
    };
    button.onmouseleave = () => {
      button.style.background = '#4f46e5';
      button.style.transform = 'scale(1)';
    };

    button.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      // Mark as intentionally revealed for this session
      card.setAttribute(REVEALED_ATTR, 'true');
      card.style.filter = '';
      card.style.opacity = '1';
      overlay.remove();
    };

    overlay.appendChild(label);
    overlay.appendChild(button);
    card.appendChild(overlay);
  }

  private removeRevealOverlay(card: HTMLElement): void {
    const existing = card.querySelector(`.${OVERLAY_CLASS}`);
    if (existing) existing.remove();
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
