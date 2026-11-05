import { FilterEngine } from '../filtering/engine';
import { YOUTUBE_SELECTORS } from './selectors';
import { ThumbnailScanner } from './thumbnail-scanner';
import { FilterStyle } from '../types';

const PROCESSED_ATTR = 'data-focus-filter-processed';
const HIDDEN_ATTR = 'data-focus-filter-hidden';
const BLURRED_ATTR = 'data-focus-filter-blurred';
const REVEALED_ATTR = 'data-focus-filter-revealed';
const OVERLAY_CLASS = 'focus-filter-reveal-overlay';
const STYLESHEET_ID = 'focus-filter-injected-styles';

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

    this.ensureInjectedStyles();
  }

  /**
   * Injects an !important CSS stylesheet directly into the page.
   * This guarantees that YouTube's native styles cannot override our hiding/blurring rules.
   */
  private ensureInjectedStyles(): void {
    if (document.getElementById(STYLESHEET_ID)) return;

    const styleEl = document.createElement('style');
    styleEl.id = STYLESHEET_ID;
    styleEl.textContent = `
      [${HIDDEN_ATTR}="true"] {
        display: none !important;
      }

      [${BLURRED_ATTR}="true"] {
        filter: blur(14px) grayscale(90%) !important;
        opacity: 0.35 !important;
        transition: filter 0.25s ease, opacity 0.25s ease !important;
        pointer-events: none !important;
        user-select: none !important;
      }

      [${BLURRED_ATTR}="true"] .${OVERLAY_CLASS} {
        pointer-events: auto !important;
        user-select: auto !important;
        filter: none !important;
        opacity: 1 !important;
      }
    `;
    (document.head || document.documentElement).appendChild(styleEl);
  }

  public setFilterStyle(style: FilterStyle): void {
    this.filterStyle = style;
  }

  public setThumbnailScanner(scanner: ThumbnailScanner): void {
    this.thumbnailScanner = scanner;
  }

  /**
   * Scans the document or root container for video cards.
   */
  public scan(root: ParentNode = document): number {
    this.ensureInjectedStyles();

    let newlyHidden = 0;
    const cards = root.querySelectorAll<HTMLElement>(YOUTUBE_SELECTORS.cards);
    const visibleCards: HTMLElement[] = [];

    cards.forEach((card) => {
      // If already processed and not hidden, keep track for thumbnail scanner
      if (card.hasAttribute(PROCESSED_ATTR)) {
        if (!card.hasAttribute(HIDDEN_ATTR) && !card.hasAttribute(BLURRED_ATTR)) {
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

    // Pass visible cards to the thumbnail OCR scanner if enabled
    if (visibleCards.length > 0 && this.thumbnailScanner) {
      this.thumbnailScanner.observeCards(visibleCards);
    }

    // Scan Shorts shelves
    const shelves = root.querySelectorAll<HTMLElement>(YOUTUBE_SELECTORS.shortsShelves);
    shelves.forEach((shelf) => {
      if (shelf.hasAttribute(PROCESSED_ATTR)) return;

      const evalResult = this.engine.evaluate('Shorts Shelf', '', true);
      shelf.setAttribute(PROCESSED_ATTR, 'true');

      if (evalResult.shouldHide) {
        shelf.setAttribute(HIDDEN_ATTR, 'true');
        shelf.style.setProperty('display', 'none', 'important');
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
   * Evaluates a single video card.
   */
  private processCard(card: HTMLElement): boolean {
    // If the user intentionally revealed this card during this session, leave it alone
    if (card.hasAttribute(REVEALED_ATTR)) {
      return false;
    }

    const title = this.extractTitle(card);
    const channel = this.extractChannel(card);

    // CRITICAL: If YouTube has NOT populated the title yet, do NOT mark as processed!
    // Returning false without PROCESSED_ATTR allows the next mutation tick to scan it
    // once YouTube hydrates the text into the DOM.
    if (!title && !channel) {
      return false;
    }

    const isShort =
      card.tagName.toLowerCase() === 'ytd-reel-item-renderer' ||
      !!card.querySelector('a[href*="/shorts/"]');

    const result = this.engine.evaluate(title, channel, isShort);

    // Now that title/channel data was present, stamp as processed
    card.setAttribute(PROCESSED_ATTR, 'true');

    if (result.shouldHide) {
      console.log(
        `%c[Focus Filter] Suppressed: "${title}" | Reason: ${result.matchedType} matched "${result.matchedKeyword}"`,
        'background: #4f46e5; color: #ffffff; padding: 2px 6px; border-radius: 4px; font-weight: bold;'
      );

      card.setAttribute(
        'data-focus-filter-reason',
        `${result.matchedType}: ${result.matchedKeyword}`
      );

      if (this.filterStyle === 'hide') {
        this.removeRevealOverlay(card);
        card.removeAttribute(BLURRED_ATTR);
        card.setAttribute(HIDDEN_ATTR, 'true');
        card.style.setProperty('display', 'none', 'important');
      } else {
        // Blur style with reveal overlay
        card.removeAttribute(HIDDEN_ATTR);
        card.style.removeProperty('display');
        card.setAttribute(BLURRED_ATTR, 'true');
        this.attachRevealOverlay(card, result.matchedKeyword || 'Distraction');
      }

      return true;
    } else {
      // If rules changed and card no longer matches, restore it
      if (card.hasAttribute(HIDDEN_ATTR) || card.hasAttribute(BLURRED_ATTR)) {
        this.restoreCard(card);
      }
      return false;
    }
  }

  private restoreCard(card: HTMLElement): void {
    card.removeAttribute(HIDDEN_ATTR);
    card.removeAttribute(BLURRED_ATTR);
    card.removeAttribute('data-focus-filter-reason');
    card.style.removeProperty('display');
    this.removeRevealOverlay(card);
  }

  private attachRevealOverlay(card: HTMLElement, keyword: string): void {
    if (card.querySelector(`.${OVERLAY_CLASS}`)) return;

    card.style.position = 'relative';

    const overlay = document.createElement('div');
    overlay.className = OVERLAY_CLASS;
    overlay.style.cssText = `
      position: absolute !important;
      inset: 0 !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      background: rgba(15, 23, 42, 0.7) !important;
      backdrop-filter: blur(8px) !important;
      z-index: 100 !important;
      border-radius: 12px !important;
      padding: 12px !important;
      cursor: default !important;
    `;

    const label = document.createElement('span');
    label.textContent = `Focus Filter: "${keyword}"`;
    label.style.cssText = `
      font-size: 11px !important;
      font-weight: 700 !important;
      color: #f8fafc !important;
      background: rgba(0, 0, 0, 0.75) !important;
      padding: 3px 8px !important;
      border-radius: 6px !important;
      margin-bottom: 8px !important;
      font-family: system-ui, -apple-system, sans-serif !important;
    `;

    const button = document.createElement('button');
    button.textContent = '👁️ Reveal Video';
    button.style.cssText = `
      font-size: 12px !important;
      font-weight: 700 !important;
      color: #ffffff !important;
      background: #4f46e5 !important;
      border: none !important;
      padding: 6px 14px !important;
      border-radius: 8px !important;
      cursor: pointer !important;
      box-shadow: 0 2px 10px rgba(79, 70, 229, 0.5) !important;
      transition: transform 0.15s ease, background 0.15s ease !important;
      font-family: system-ui, -apple-system, sans-serif !important;
    `;

    button.onmouseenter = () => {
      button.style.background = '#4338ca';
      button.style.transform = 'scale(1.05)';
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
      card.removeAttribute(BLURRED_ATTR);
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
   * Re-evaluates every card on the page.
   * Called when settings, keywords, or filters change in the popup.
   */
  public reEvaluateAll(): void {
    this.ensureInjectedStyles();

    const allCards = document.querySelectorAll<HTMLElement>(
      `[${PROCESSED_ATTR}], ${YOUTUBE_SELECTORS.cards}`
    );

    let newlyHidden = 0;

    allCards.forEach((card) => {
      card.removeAttribute(PROCESSED_ATTR);

      if (
        card.matches(YOUTUBE_SELECTORS.shortsShelves) ||
        card.tagName.toLowerCase().includes('shelf')
      ) {
        const evalResult = this.engine.evaluate('Shorts Shelf', '', true);
        card.setAttribute(PROCESSED_ATTR, 'true');
        if (evalResult.shouldHide) {
          card.setAttribute(HIDDEN_ATTR, 'true');
          card.style.setProperty('display', 'none', 'important');
        } else {
          card.removeAttribute(HIDDEN_ATTR);
          card.style.removeProperty('display');
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
    // 1. Check title elements directly
    const titleEl = card.querySelector<HTMLElement>(YOUTUBE_SELECTORS.titles);
    if (titleEl) {
      const text = (
        titleEl.getAttribute('title') ||
        titleEl.getAttribute('aria-label') ||
        titleEl.textContent ||
        titleEl.innerText ||
        ''
      ).trim();
      if (text) return text;
    }

    // 2. Check universal h3 headings
    const h3 = card.querySelector<HTMLElement>('h3');
    if (h3) {
      const text = (
        h3.getAttribute('title') ||
        h3.getAttribute('aria-label') ||
        h3.textContent ||
        h3.innerText ||
        ''
      ).trim();
      if (text) return text;
    }

    // 3. Check any watch links inside the card
    const link = card.querySelector<HTMLAnchorElement>('a[href*="/watch"], a#video-title-link');
    if (link) {
      const text = (
        link.getAttribute('title') ||
        link.getAttribute('aria-label') ||
        link.textContent ||
        link.innerText ||
        ''
      ).trim();
      if (text) return text;
    }

    return '';
  }

  private extractChannel(card: HTMLElement): string {
    const channelEl = card.querySelector<HTMLElement>(YOUTUBE_SELECTORS.channels);
    if (channelEl) {
      const text = (
        channelEl.textContent ||
        channelEl.innerText ||
        channelEl.getAttribute('title') ||
        ''
      ).trim();
      if (text) return text;
    }

    const channelLink = card.querySelector<HTMLAnchorElement>(
      'a[href^="/@"], a[href*="/channel/"]'
    );
    if (channelLink) {
      const text = (
        channelLink.textContent ||
        channelLink.innerText ||
        channelLink.getAttribute('title') ||
        ''
      ).trim();
      if (text) return text;
    }

    return '';
  }
}
