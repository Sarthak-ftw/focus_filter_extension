import { createWorker, Worker } from 'tesseract.js';

class ThumbnailOcrService {
  private worker: Worker | null = null;
  private isInitializing: boolean = false;
  private initPromise: Promise<void> | null = null;
  private cache: Map<string, string> = new Map();
  private queue: Array<{
    imageUrl: string;
    resolve: (text: string) => void;
    reject: (err: unknown) => void;
  }> = [];
  private isProcessingQueue: boolean = false;

  /**
   * Lazily initializes the Tesseract OCR worker on demand.
   */
  private async getWorker(): Promise<Worker> {
    if (this.worker) return this.worker;

    if (this.isInitializing && this.initPromise) {
      await this.initPromise;
      return this.worker!;
    }

    this.isInitializing = true;
    this.initPromise = (async () => {
      try {
        console.log('[Focus Filter AI] Initializing Tesseract OCR engine...');
        const worker = await createWorker('eng');
        this.worker = worker;
        console.log('[Focus Filter AI] OCR engine ready.');
      } catch (err) {
        console.warn('[Focus Filter AI] Failed to initialize worker, fallback to stub:', err);
        throw err;
      } finally {
        this.isInitializing = false;
      }
    })();

    await this.initPromise;
    return this.worker!;
  }

  /**
   * Recognizes text from an image URL.
   * Leverages an in-memory URL cache and a FIFO concurrency queue.
   */
  public async recognizeText(imageUrl: string): Promise<string> {
    if (!imageUrl) return '';

    // 1. Check cache to avoid duplicate inference
    if (this.cache.has(imageUrl)) {
      return this.cache.get(imageUrl)!;
    }

    // 2. Queue the request
    return new Promise<string>((resolve, reject) => {
      this.queue.push({ imageUrl, resolve, reject });
      this.processNextInQueue();
    });
  }

  private async processNextInQueue(): Promise<void> {
    if (this.isProcessingQueue || this.queue.length === 0) return;

    this.isProcessingQueue = true;
    const task = this.queue.shift();

    if (!task) {
      this.isProcessingQueue = false;
      return;
    }

    try {
      // Check cache again in case processed while in queue
      if (this.cache.has(task.imageUrl)) {
        task.resolve(this.cache.get(task.imageUrl)!);
      } else {
        const worker = await this.getWorker();
        const { data } = await worker.recognize(task.imageUrl);
        const extracted = data.text || '';
        this.cache.set(task.imageUrl, extracted);
        task.resolve(extracted);
      }
    } catch (err) {
      console.warn('[Focus Filter AI] OCR recognition failed for:', task.imageUrl, err);
      // Cache empty string on failure to prevent infinite retry loops
      this.cache.set(task.imageUrl, '');
      task.resolve('');
    } finally {
      this.isProcessingQueue = false;
      // Continue processing next item after small delay to yield main thread
      setTimeout(() => this.processNextInQueue(), 50);
    }
  }

  public clearCache(): void {
    this.cache.clear();
  }
}

export const OcrService = new ThumbnailOcrService();
