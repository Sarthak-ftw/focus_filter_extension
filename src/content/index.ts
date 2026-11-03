import { StorageService } from '../services/storage';
import { FilterEngine } from '../filtering/engine';
import { YouTubeScanner } from './scanner';
import { YouTubeObserver } from './observer';
import { FilterSettings } from '../types';

console.log(
  '%c[Focus Filter] Active on YouTube. Level 1 Filtering Engine ready.',
  'background: #4f46e5; color: #ffffff; font-weight: bold; padding: 4px 8px; border-radius: 4px;'
);

let filterEngine: FilterEngine;
let scanner: YouTubeScanner;
let observer: YouTubeObserver;

// Initialize components asynchronously
async function initializeFocusFilter(): Promise<void> {
  const settings = await StorageService.getSettings();

  // 1. Instantiate pure filtering engine
  filterEngine = new FilterEngine(
    settings.keywords,
    settings.channels,
    settings.hideShorts,
    settings.isEnabled
  );

  // 2. Instantiate DOM scanner with count reporter
  scanner = new YouTubeScanner(filterEngine, async (newCount) => {
    // Sync hidden count to extension storage
    const current = await StorageService.getSettings();
    await StorageService.saveSettings({
      ...current,
      stats: {
        ...current.stats,
        videosHiddenCount: current.stats.videosHiddenCount + newCount,
      },
    });
  });

  // 3. Instantiate mutation observer and start watching DOM
  observer = new YouTubeObserver(scanner);
  observer.start();

  // 4. Reactively update rules when user edits settings in the popup
  StorageService.onSettingsChange((updatedSettings: FilterSettings) => {
    filterEngine.updateRules(
      updatedSettings.keywords,
      updatedSettings.channels,
      updatedSettings.hideShorts,
      updatedSettings.isEnabled
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
