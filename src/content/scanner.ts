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
   * Guarantees YouTube's native styles cannot override hiding/blurring rules.
   */
  private ensureInjectedStyles(): void {
    if (document.getElementById(STYLESHEET_ID)) return;

    const styleEl = document.createElement('style');
    styleEl.id = STYLESHEET_ID;
    styleEl.textContent = `
      [${HIDDEN_ATTR}="true"] {
        display: none !important;
      }

      /* Blur card contents while keeping reveal overlay sharp & clickable */
      [${BLURRED_ATTR}="true"] > *:not(.${OVERLAY_CLASS}) {
        filter: blur(14px) grayscale(90%) !important;
        opacity: 0.3 !important;
        transition: filter 0.25s ease, opacity 0.25s ease !important;
        pointer-events: none !important;
        user-select: none !important;
      }

      [${BLURRED_ATTR}="true"] {
        position: relative !important;
      }

      .${OVERLAY_CLASS} {
        position: absolute !important;
        inset: 0 !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        z-index: 9999 !important;
        background: rgba(15, 23, 42, 0.75) !important;
        backdrop-filter: blur(8px) !important;
        border-radius: 12px !important;
        padding: 12px !important;
        pointer-events: auto !important;
        user-select: auto !important;
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
   */
  public scan(root: ParentNode = document): number {
    this.ensureInjectedStyles();

    let newlyHidden = 0;
    const cards = root.querySelectorAll<HTMLElement>(YOUTUBE_SELECTORS.cards);
    const visibleCards: HTMLElement[] = [];

    cards.forEach((card) => {
      // Skip already-processed cards entirely to avoid duplicate work and double-counting
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

    // Pass visible cards to thumbnail scanner if enabled
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
      this.onCountIncrement(newlyHidden);
    }

    return newlyHidden;
  }

  /**
   * Evaluates a single video card. Marks it as processed when done.
   */
  private processCard(card: HTMLElement): boolean {
    // If the user intentionally revealed this card during this session, leave it alone
    if (card.hasAttribute(REVEALED_ATTR)) {
      card.setAttribute(PROCESSED_ATTR, 'true');
      return false;
    }

    const title = this.extractTitle(card);
    const channel = this.extractChannel(card);

    // If YouTube has NOT populated the title or channel yet, wait for hydration
    if (!title && !channel) {
      return false;
    }

    const isShort =
      card.tagName.toLowerCase().includes('reel') ||
      card.tagName.toLowerCase().includes('shorts') ||
      !!card.querySelector('a[href*="/shorts/"]');

    let evalResult = this.engine.evaluate(title, channel, isShort);

    // Defense-in-depth: If title and channel didn't directly match,
    // inspect the card's metadata container (covers watch page sidebar lockups)
    if (!evalResult.shouldHide) {
      const metaContainer = card.querySelector<HTMLElement>(
        'yt-content-metadata-view-model, .yt-content-metadata-view-model__metadata-row, #metadata, #metadata-line, #byline-container'
      );
      if (metaContainer) {
        const metaText = (metaContainer.textContent || metaContainer.innerText || '').trim();
        if (metaText) {
          const metaEval = this.engine.evaluate('', metaText, false);
          if (metaEval.shouldHide) {
            evalResult = {
              shouldHide: true,
              matchedKeyword: metaEval.matchedKeyword,
              matchedType: 'channel',
            };
          }
        }
      }
    }

    // Mark as processed
    card.setAttribute(PROCESSED_ATTR, 'true');

    if (evalResult.shouldHide) {
      this.applyFilter(card, evalResult.matchedKeyword);
      return true;
    } else {
      this.removeFilter(card);
      return false;
    }
  }

  private applyFilter(card: HTMLElement, matchedKeyword?: string): void {
    if (this.filterStyle === 'hide') {
      card.removeAttribute(BLURRED_ATTR);
      this.removeRevealOverlay(card);
      card.setAttribute(HIDDEN_ATTR, 'true');
    } else {
      // blur mode
      card.removeAttribute(HIDDEN_ATTR);
      card.setAttribute(BLURRED_ATTR, 'true');
      this.ensureRevealOverlay(card, matchedKeyword);
    }
  }

  private removeFilter(card: HTMLElement): void {
    card.removeAttribute(HIDDEN_ATTR);
    card.removeAttribute(BLURRED_ATTR);
    this.removeRevealOverlay(card);
  }

  private ensureRevealOverlay(card: HTMLElement, matchedKeyword?: string): void {
    if (card.querySelector(`.${OVERLAY_CLASS}`)) return;

    const overlay = document.createElement('div');
    overlay.className = OVERLAY_CLASS;

    const label = document.createElement('p');
    label.textContent = matchedKeyword
      ? `\u{1F6E1} Focus Filter: "${matchedKeyword}"`
      : '\u{1F6E1} Focus Filter';
    label.style.cssText = `
      font-size: 11px !important;
      font-weight: 700 !important;
      color: #f8fafc !important;
      background: rgba(0, 0, 0, 0.75) !important;
      padding: 3px 8px !important;
      border-radius: 6px !important;
      margin-bottom: 8px !important;
      font-family: system-ui, -apple-system, sans-serif !important;
      text-align: center !important;
      max-width: 90% !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
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
   * Re-evaluates every card on the page when settings change.
   */
  public reEvaluateAll(): void {
    this.ensureInjectedStyles();

    const allCards = document.querySelectorAll<HTMLElement>(
      `[${PROCESSED_ATTR}], ${YOUTUBE_SELECTORS.cards}`
    );

    let newlyHiddenByRuleChange = 0;

    allCards.forEach((card) => {
      const wasAlreadyFiltered =
        card.hasAttribute(HIDDEN_ATTR) || card.hasAttribute(BLURRED_ATTR);
      const wasRevealed = card.hasAttribute(REVEALED_ATTR);

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
        if (wasRevealed) {
          card.setAttribute(PROCESSED_ATTR, 'true');
          return;
        }

        const isNowFiltered = this.processCard(card);

        if (isNowFiltered && !wasAlreadyFiltered) {
          newlyHiddenByRuleChange++;
        }
      }
    });

    if (newlyHiddenByRuleChange > 0 && this.onCountIncrement) {
      this.onCountIncrement(newlyHiddenByRuleChange);
    }
  }

  /**
   * Robust multi-tier title extraction pipeline.
   * Targets the exact title element while strictly ignoring thumbnail overlays/duration badges.
   */
  private extractTitle(card: HTMLElement): string {
    // 1. Primary: Dedicated YouTube #video-title element (Present on standard Search & Home cards)
    const videoTitleEl = card.querySelector<HTMLElement>(
      '#video-title, #video-title-link, a#video-title, span#video-title, yt-formatted-string#video-title'
    );
    if (videoTitleEl) {
      const text = (
        videoTitleEl.getAttribute('title') ||
        videoTitleEl.getAttribute('aria-label') ||
        videoTitleEl.textContent ||
        videoTitleEl.innerText ||
        ''
      ).trim();
      if (text) return text;
    }

    // 2. Secondary: h3 heading containers (The universal wrapper for YouTube video titles)
    const h3 = card.querySelector<HTMLElement>('h3');
    if (h3) {
      const titleLink = h3.querySelector<HTMLAnchorElement>('a');
      const text = (
        titleLink?.getAttribute('title') ||
        titleLink?.getAttribute('aria-label') ||
        titleLink?.textContent ||
        h3.getAttribute('title') ||
        h3.getAttribute('aria-label') ||
        h3.textContent ||
        ''
      ).trim();
      if (text) return text;
    }

    // 3. Modern Lockup title elements (Wiz / Lit components)
    const lockupTitle = card.querySelector<HTMLElement>(
      '.yt-lockup-metadata-view-model-wiz__title, .yt-lockup-metadata-view-model__title, .shortsLockupViewModelHostTitle, #title-wrapper'
    );
    if (lockupTitle) {
      const text = (
        lockupTitle.getAttribute('title') ||
        lockupTitle.getAttribute('aria-label') ||
        lockupTitle.textContent ||
        ''
      ).trim();
      if (text) return text;
    }

    // 4. Shorts links (Shorts cards often store title in title/aria-label on the /shorts/ link)
    const shortsLink = card.querySelector<HTMLAnchorElement>('a[href*="/shorts/"]');
    if (shortsLink) {
      const text = (
        shortsLink.getAttribute('title') ||
        shortsLink.getAttribute('aria-label') ||
        shortsLink.textContent ||
        ''
      ).trim();
      if (text) return text;
    }

    return '';
  }

  /**
   * Extracts channel name across Home feed, Search results, and Watch Page sidebar.
   */
  private extractChannel(card: HTMLElement): string {
    // 1. Check direct channel selectors from dictionary
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

    // 2. Channel links (/@channel or /channel/id)
    const channelLink = card.querySelector<HTMLAnchorElement>(
      'a[href^="/@"], a[href*="/channel/"], a[href*="/user/"]'
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

    // 3. Modern view-model first metadata row (typically holds channel name in sidebar lockups)
    const metaRow = card.querySelector<HTMLElement>(
      '.yt-content-metadata-view-model__metadata-row, .ytContentMetadataViewModelMetadataRow'
    );
    if (metaRow) {
      const text = (metaRow.textContent || metaRow.innerText || '').trim();
      if (text) return text;
    }

    // 4. Byline containers
    const byline = card.querySelector<HTMLElement>('#byline, #byline-text, #channel-name, .ytd-channel-name');
    if (byline) {
      const text = (byline.textContent || byline.innerText || '').trim();
      if (text) return text;
    }

    return '';
  }
}
