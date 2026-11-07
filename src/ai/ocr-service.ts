/**
 * Thumbnail OCR Service
 *
 * In Chrome Extensions (Manifest V3), Content Scripts run in the execution
 * context of the host webpage (e.g., https://www.youtube.com).
 * YouTube enforces a strict Content Security Policy (CSP) that explicitly
 * forbids creating Web Workers via blob URLs (`worker-src blob:`).
 *
 * Therefore, heavy inference or worker instantiation MUST NEVER run directly
 * inside the content script. Instead, this service sends asynchronous messages
 * to the extension's background service worker / offscreen pipeline via
 * `chrome.runtime.sendMessage`, completely isolating YouTube's page from CSP
 * violations.
 */

class ThumbnailOcrService {
  private cache: Map<string, string> = new Map();
  private inFlight: Map<string, Promise<string>> = new Map();

  /**
   * Recognizes text from an image URL.
   * Leverages an in-memory URL cache and deduplicates concurrent in-flight requests.
   */
  public async recognizeText(imageUrl: string): Promise<string> {
    if (!imageUrl) return '';

    // 1. Check in-memory cache to avoid duplicate processing
    if (this.cache.has(imageUrl)) {
      return this.cache.get(imageUrl)!;
    }

    // 2. Deduplicate identical in-flight requests
    if (this.inFlight.has(imageUrl)) {
      return this.inFlight.get(imageUrl)!;
    }

    const requestPromise = this.requestAnalysis(imageUrl);
    this.inFlight.set(imageUrl, requestPromise);

    try {
      const result = await requestPromise;
      this.cache.set(imageUrl, result);
      return result;
    } finally {
      this.inFlight.delete(imageUrl);
    }
  }

  private requestAnalysis(imageUrl: string): Promise<string> {
    return new Promise<string>((resolve) => {
      // Guard against non-extension environments (e.g. unit tests)
      if (
        typeof chrome === 'undefined' ||
        !chrome.runtime ||
        !chrome.runtime.sendMessage
      ) {
        resolve('');
        return;
      }

      try {
        chrome.runtime.sendMessage(
          {
            type: 'ANALYZE_THUMBNAIL',
            payload: { imageUrl },
          },
          (response) => {
            if (chrome.runtime.lastError) {
              // Service worker inactive or message port closed — non-critical
              resolve('');
              return;
            }

            if (response && typeof response.text === 'string') {
              resolve(response.text);
            } else {
              resolve('');
            }
          }
        );
      } catch {
        resolve('');
      }
    });
  }

  public clearCache(): void {
    this.cache.clear();
    this.inFlight.clear();
  }
}

export const OcrService = new ThumbnailOcrService();
