import { StorageService } from '../services/storage';
import { FilterEngine } from '../filtering/engine';
import { YouTubeScanner } from './scanner';
import { YouTubeObserver } from './observer';
import { ThumbnailScanner } from './thumbnail-scanner';
import { FilterSettings } from '../types';

console.log(
  '%c[Focus Filter] Active on YouTube. Level 2 AI Thumbnail & Keyword Filter ready.',
  'background: #4f46e5; color: #ffffff; font-weight: bold; padding: 4px 8px; border-radius: 4px;'
);

let filterEngine: FilterEngine;
let thumbnailScanner: ThumbnailScanner;
let scanner: YouTubeScanner;
let observer: YouTubeObserver;

// Initialize components asynchronously
async function initializeFocusFilter(): Promise<void> {
  const settings = await StorageService.getSettings();

  // 1. Instantiate pure filtering engine with allowlist
  filterEngine = new FilterEngine(
    settings.keywords,
    settings.channels,
    settings.allowlist || [],
    settings.hideShorts,
    settings.isEnabled
  );

  // 2. Instantiate Thumbnail AI Scanner (OCR)
  thumbnailScanner = new ThumbnailScanner(
    filterEngine,
    settings.enableThumbnailAI && settings.isEnabled,
    async (newCount) => {
      const current = await StorageService.getSettings();
      await StorageService.saveSettings({
        ...current,
        stats: {
          ...current.stats,
          videosHiddenCount: current.stats.videosHiddenCount + newCount,
        },
      });
    }
  );

  // 3. Instantiate DOM scanner with count reporter, thumbnail scanner, and filter style
  scanner = new YouTubeScanner(
    filterEngine,
    thumbnailScanner,
    settings.filterStyle || 'blur',
    async (newCount) => {
      const current = await StorageService.getSettings();
      await StorageService.saveSettings({
        ...current,
        stats: {
          ...current.stats,
          videosHiddenCount: current.stats.videosHiddenCount + newCount,
        },
      });
    }
  );

  // 4. Instantiate mutation observer and start watching DOM
  observer = new YouTubeObserver(scanner);
  observer.start();

  // 5. Reactively update rules when user edits settings in the popup
  StorageService.onSettingsChange((updatedSettings: FilterSettings) => {
    filterEngine.updateRules(
      updatedSettings.keywords,
      updatedSettings.channels,
      updatedSettings.allowlist || [],
      updatedSettings.hideShorts,
      updatedSettings.isEnabled
    );

    scanner.setFilterStyle(updatedSettings.filterStyle || 'blur');

    thumbnailScanner.setEnabled(
      updatedSettings.enableThumbnailAI && updatedSettings.isEnabled
    );

    // Re-evaluate current DOM cards instantly without requiring page reload
    scanner.reEvaluateAll();
  });
}

// Ensure execution when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeFocusFilter);
} else {
  initializeFocusFilter();
}
