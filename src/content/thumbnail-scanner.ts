import { FilterEngine } from '../filtering/engine';
import { OcrService } from '../ai/ocr-service';

const OCR_PROCESSED_ATTR = 'data-focus-filter-ocr-done';

export class ThumbnailScanner {
  private engine: FilterEngine;
  private observer: IntersectionObserver | null = null;
  private isEnabled: boolean = true;
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

  private initObserver(): void {
    if (typeof IntersectionObserver === 'undefined') return;

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const card = entry.target as HTMLElement;
            // Unobserve immediately once visible to avoid redundant triggers
            this.observer?.unobserve(card);
            this.processVisibleThumbnail(card);
          }
        });
      },
      {
        rootMargin: '100px', // Pre-fetch thumbnails 100px before they scroll into view
        threshold: 0.1,
      }
    );
  }

  /**
   * Registers eligible video cards for viewport intersection monitoring.
   */
  public observeCards(cards: NodeListOf<HTMLElement> | HTMLElement[]): void {
    if (!this.isEnabled || !this.observer) return;

    cards.forEach((card) => {
      // Skip if already hidden by title filter or already OCR-scanned
      if (
        card.hasAttribute('data-focus-filter-hidden') ||
        card.hasAttribute(OCR_PROCESSED_ATTR)
      ) {
        return;
      }

      this.observer?.observe(card);
    });
  }

  /**
   * Extracts thumbnail image and runs OCR inference.
   */
  private async processVisibleThumbnail(card: HTMLElement): Promise<void> {
    if (!this.isEnabled || card.hasAttribute(OCR_PROCESSED_ATTR)) return;

    card.setAttribute(OCR_PROCESSED_ATTR, 'true');

    const img = card.querySelector<HTMLImageElement>(
      'ytd-thumbnail img, a#thumbnail img, #thumbnail img'
    );

    if (!img) return;

    // Get live image source (handles lazy-loading)
    const src = img.currentSrc || img.src;

    // Skip empty, placeholder, or base64 1x1 tracking pixels
    if (!src || src.startsWith('data:image/gif') || src.includes('pixel')) {
      // If image is still loading, wait for the onload event
      img.addEventListener(
        'load',
        () => {
          const loadedSrc = img.currentSrc || img.src;
          if (loadedSrc) this.runOcrOnImage(loadedSrc, card);
        },
        { once: true }
      );
      return;
    }

    await this.runOcrOnImage(src, card);
  }

  private async runOcrOnImage(src: string, card: HTMLElement): Promise<void> {
    try {
      const extractedText = await OcrService.recognizeText(src);
      if (!extractedText) return;

      const result = this.engine.evaluate(extractedText, '', false);

      if (result.shouldHide) {
        console.log(
          `%c[Focus Filter AI] Suppressed video by Thumbnail OCR: "${result.matchedKeyword}"`,
          'color: #f43f5e; font-weight: bold;',
          { src, extractedText }
        );

        card.style.display = 'none';
        card.setAttribute('data-focus-filter-hidden', 'true');
        card.setAttribute(
          'data-focus-filter-reason',
          `thumbnail-ocr: ${result.matchedKeyword}`
        );

        if (this.onHiddenCountIncrement) {
          this.onHiddenCountIncrement(1);
        }
      }
    } catch (err) {
      console.debug('[Focus Filter AI] Thumbnail scan skipped:', err);
    }
  }

  public disconnect(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}
