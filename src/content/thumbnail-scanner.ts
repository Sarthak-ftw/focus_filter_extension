import { FilterEngine } from '../filtering/engine';
import { OcrService } from '../ai/ocr-service';

const OCR_PROCESSED_ATTR = 'data-focus-filter-ocr-done';
const HIDDEN_ATTR = 'data-focus-filter-hidden';
const BLURRED_ATTR = 'data-focus-filter-blurred';
const OVERLAY_CLASS = 'focus-filter-reveal-overlay';
const REVEALED_ATTR = 'data-focus-filter-revealed';

export class ThumbnailScanner {
  private engine: FilterEngine;
  private observer: IntersectionObserver | null = null;
  private isEnabled: boolean = true;
  private filterStyle: 'hide' | 'blur' = 'blur';
  private onHiddenCountIncrement?: (count: number) => void;

  constructor(
    engine: FilterEngine,
    isEnabled: boolean = true,
    onHiddenCountIncrement?: (count: number) => void
  ) {
    this.engine = engine;
    this.isEnabled = isEnabled;
    this.onHiddenCountIncrement = onHiddenCountIncrement;
    this.initObserver();
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  public setFilterStyle(style: 'hide' | 'blur'): void {
    this.filterStyle = style;
  }

  private initObserver(): void {
    if (typeof IntersectionObserver === 'undefined') return;

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const card = entry.target as HTMLElement;
            this.observer?.unobserve(card);
            this.processVisibleThumbnail(card);
          }
        });
      },
      { rootMargin: '150px', threshold: 0.05 }
    );
  }

  public observeCards(cards: NodeListOf<HTMLElement> | HTMLElement[]): void {
    if (!this.isEnabled || !this.observer) return;

    cards.forEach((card) => {
      if (
        card.hasAttribute(HIDDEN_ATTR) ||
        card.hasAttribute(BLURRED_ATTR) ||
        card.hasAttribute(OCR_PROCESSED_ATTR) ||
        card.hasAttribute(REVEALED_ATTR)
      ) return;

      this.observer?.observe(card);
    });
  }

  private async processVisibleThumbnail(card: HTMLElement): Promise<void> {
    if (!this.isEnabled || card.hasAttribute(OCR_PROCESSED_ATTR)) return;
    if (card.hasAttribute(HIDDEN_ATTR) || card.hasAttribute(BLURRED_ATTR)) return;

    card.setAttribute(OCR_PROCESSED_ATTR, 'true');

    const img = card.querySelector<HTMLImageElement>(
      'ytd-thumbnail img, a#thumbnail img, #thumbnail img, img[src*="ytimg"]'
    );
    if (!img) return;

    const src = img.currentSrc || img.src;

    if (!src || src.startsWith('data:image/gif') || src.includes('pixel') || src.length < 10) {
      img.addEventListener('load', () => {
        const loadedSrc = img.currentSrc || img.src;
        if (loadedSrc && loadedSrc.length > 10) this.runOcrOnImage(loadedSrc, card);
      }, { once: true });
      return;
    }

    await this.runOcrOnImage(src, card);
  }

  private async runOcrOnImage(src: string, card: HTMLElement): Promise<void> {
    try {
      const extractedText = await OcrService.recognizeText(src);
      if (!extractedText || !extractedText.trim()) return;

      // Skip if card was hidden by title scanner while we were processing OCR
      if (card.hasAttribute(HIDDEN_ATTR) || card.hasAttribute(BLURRED_ATTR)) return;

      const result = this.engine.evaluate(extractedText, '', false);

      if (result.shouldHide) {
        if (this.filterStyle === 'hide') {
          card.setAttribute(HIDDEN_ATTR, 'true');
          card.style.setProperty('display', 'none', 'important');
        } else {
          card.setAttribute(BLURRED_ATTR, 'true');
          this.attachRevealOverlay(card, result.matchedKeyword || 'Distraction');
        }

        card.setAttribute('data-focus-filter-reason', `thumbnail-ocr: ${result.matchedKeyword}`);

        if (this.onHiddenCountIncrement) {
          this.onHiddenCountIncrement(1);
        }
      }
    } catch {
      // Silently skip — OCR failures are non-critical
    }
  }

  private attachRevealOverlay(card: HTMLElement, keyword: string): void {
    if (card.querySelector(`.${OVERLAY_CLASS}`)) return;
    card.style.position = 'relative';

    const overlay = document.createElement('div');
    overlay.className = OVERLAY_CLASS;
    overlay.style.cssText = `
      position: absolute !important; inset: 0 !important;
      display: flex !important; flex-direction: column !important;
      align-items: center !important; justify-content: center !important;
      background: rgba(15, 23, 42, 0.7) !important;
      backdrop-filter: blur(8px) !important;
      z-index: 100 !important; border-radius: 12px !important;
      padding: 12px !important; cursor: default !important;
    `;

    const label = document.createElement('span');
    label.textContent = `Focus Filter (AI): "${keyword}"`;
    label.style.cssText = `
      font-size: 11px !important; font-weight: 700 !important;
      color: #f8fafc !important; background: rgba(0,0,0,0.75) !important;
      padding: 3px 8px !important; border-radius: 6px !important;
      margin-bottom: 8px !important; font-family: system-ui, sans-serif !important;
    `;

    const button = document.createElement('button');
    button.textContent = '👁️ Reveal Video';
    button.style.cssText = `
      font-size: 12px !important; font-weight: 700 !important;
      color: #fff !important; background: #4f46e5 !important;
      border: none !important; padding: 6px 14px !important;
      border-radius: 8px !important; cursor: pointer !important;
      font-family: system-ui, sans-serif !important;
    `;

    button.onclick = (e) => {
      e.stopPropagation(); e.preventDefault();
      card.setAttribute(REVEALED_ATTR, 'true');
      card.removeAttribute(BLURRED_ATTR);
      overlay.remove();
    };

    overlay.appendChild(label);
    overlay.appendChild(button);
    card.appendChild(overlay);
  }

  public disconnect(): void {
    this.observer?.disconnect();
  }
}
