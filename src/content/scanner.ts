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
   * Only processes cards that have NOT been processed yet.
   * This is the main hot path called by the MutationObserver.
   */
  public scan(root: ParentNode = document): number {
    this.ensureInjectedStyles();

    let newlyHidden = 0;
    const cards = root.querySelectorAll<HTMLElement>(YOUTUBE_SELECTORS.cards);
    const visibleCards: HTMLElement[] = [];

    cards.forEach((card) => {
      // Skip already-processed cards entirely — they will not be re-counted
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

    // Report only the *newly* hidden count this scan call, not the cumulative total.
    if (newlyHidden > 0 && this.onCountIncrement) {
      this.onCountIncrement(newlyHidden);
    }

    return newlyHidden;
  }

  /**
   * Evaluates a single video card. Marks it as processed when done.
   * Returns true if the card should be hidden/blurred.
   */
  private processCard(card: HTMLElement): boolean {
    // If the user intentionally revealed this card during this session, leave it alone
    if (card.hasAttribute(REVEALED_ATTR)) {
      card.setAttribute(PROCESSED_ATTR, 'true');
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

    const evalResult = this.engine.evaluate(title, channel, isShort);

    // Mark as processed BEFORE applying visual changes to prevent double-processing
    card.setAttribute(PROCESSED_ATTR, 'true');

    if (evalResult.shouldHide) {
      this.applyFilter(card);
      return true;
    } else {
      // Ensure previously-filtered cards that are now allowed are shown
      this.removeFilter(card);
      return false;
    }
  }

  private applyFilter(card: HTMLElement): void {
    if (this.filterStyle === 'hide') {
      card.removeAttribute(BLURRED_ATTR);
      this.removeRevealOverlay(card);
      card.setAttribute(HIDDEN_ATTR, 'true');
    } else {
      // blur mode
      card.removeAttribute(HIDDEN_ATTR);
      card.setAttribute(BLURRED_ATTR, 'true');
      this.ensureRevealOverlay(card);
    }
  }

  private removeFilter(card: HTMLElement): void {
    card.removeAttribute(HIDDEN_ATTR);
    card.removeAttribute(BLURRED_ATTR);
    this.removeRevealOverlay(card);
  }

  private ensureRevealOverlay(card: HTMLElement): void {
    if (card.querySelector(`.${OVERLAY_CLASS}`)) return;

    const overlay = document.createElement('div');
    overlay.className = OVERLAY_CLASS;
    overlay.style.cssText = `
      position: absolute !important;
      inset: 0 !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      z-index: 9999 !important;
      border-radius: 12px !important;
    `;
    card.style.position = 'relative';

    const label = document.createElement('p');
    label.textContent = '\u{1F6E1} Focus Filter';
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
    button.textContent = '\u{1F441} Reveal Video';
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
   * Re-evaluates every card on the page when settings/keywords change.
   *
   * KEY FIX: We reset PROCESSED_ATTR so cards are re-evaluated with new rules,
   * but we do NOT count already-hidden/blurred cards as "newly hidden" in the stats.
   * We ONLY count cards that were previously VISIBLE and are now being hidden for
   * the first time due to the new keyword/channel rule.
   */
  public reEvaluateAll(): void {
    this.ensureInjectedStyles();

    const allCards = document.querySelectorAll<HTMLElement>(
      `[${PROCESSED_ATTR}], ${YOUTUBE_SELECTORS.cards}`
    );

    let newlyHiddenByRuleChange = 0;

    allCards.forEach((card) => {
      // Record the PREVIOUS state before we reset anything
      const wasAlreadyFiltered =
        card.hasAttribute(HIDDEN_ATTR) || card.hasAttribute(BLURRED_ATTR);
      const wasRevealed = card.hasAttribute(REVEALED_ATTR);

      // Reset processed so processCard runs a fresh evaluation
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
        // If the user intentionally revealed this card, don't re-filter it
        if (wasRevealed) {
          card.setAttribute(PROCESSED_ATTR, 'true');
          return;
        }

        const isNowFiltered = this.processCard(card);

        // ONLY count toward stats if the card was not already hidden before
        // This prevents the runaway counter when settings change
        if (isNowFiltered && !wasAlreadyFiltered) {
          newlyHiddenByRuleChange++;
        }
      }
    });

    // Only report truly new catches from the rule change
    if (newlyHiddenByRuleChange > 0 && this.onCountIncrement) {
      this.onCountIncrement(newlyHiddenByRuleChange);
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
