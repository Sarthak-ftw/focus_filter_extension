import { StorageService } from '../services/storage';
import { FilterEngine } from '../filtering/engine';
import { YouTubeScanner } from './scanner';
import { YouTubeObserver } from './observer';
import { ThumbnailScanner } from './thumbnail-scanner';
import { FilterSettings } from '../types';

console.log(
  '%c[Focus Filter] Content script active.',
  'background: #4f46e5; color: #ffffff; font-weight: bold; padding: 4px 8px; border-radius: 4px;'
);

let filterEngine: FilterEngine;
let thumbnailScanner: ThumbnailScanner;
let scanner: YouTubeScanner;
let observer: YouTubeObserver;

let localHiddenCount = 0;
let pendingStorageWrite: ReturnType<typeof setTimeout> | null = null;

function reportHidden(newlyHidden: number): void {
  if (newlyHidden <= 0) return;
  localHiddenCount += newlyHidden;

  if (pendingStorageWrite) clearTimeout(pendingStorageWrite);

  pendingStorageWrite = setTimeout(async () => {
    pendingStorageWrite = null;
    const snapshot = localHiddenCount;
    localHiddenCount = 0;

    try {
      const current = await StorageService.getSettings();
      await StorageService.saveSettings({
        ...current,
        stats: {
          ...current.stats,
          videosHiddenCount: current.stats.videosHiddenCount + snapshot,
        },
      });
    } catch {
      // Non-critical — stats write failed
    }
  }, 1500);
}

async function initializeFocusFilter(): Promise<void> {
  const settings = await StorageService.getSettings();

  filterEngine = new FilterEngine(
    settings.keywords,
    settings.channels,
    settings.allowlist || [],
    settings.hideShorts,
    settings.isEnabled
  );

  thumbnailScanner = new ThumbnailScanner(
    filterEngine,
    settings.enableThumbnailAI && settings.isEnabled,
    reportHidden
  );
  thumbnailScanner.setFilterStyle(settings.filterStyle || 'blur');

  scanner = new YouTubeScanner(
    filterEngine,
    thumbnailScanner,
    settings.filterStyle || 'blur',
    reportHidden
  );

  observer = new YouTubeObserver(scanner);
  observer.start();

  let lastRuleHash = getRuleHash(settings);

  StorageService.onSettingsChange((updated: FilterSettings) => {
    const newHash = getRuleHash(updated);

    filterEngine.updateRules(
      updated.keywords,
      updated.channels,
      updated.allowlist || [],
      updated.hideShorts,
      updated.isEnabled
    );

    const style = updated.filterStyle || 'blur';
    scanner.setFilterStyle(style);
    thumbnailScanner.setEnabled(updated.enableThumbnailAI && updated.isEnabled);
    thumbnailScanner.setFilterStyle(style);

    if (newHash !== lastRuleHash) {
      lastRuleHash = newHash;
      scanner.reEvaluateAll();
    }
  });
}

function getRuleHash(s: FilterSettings): string {
  return JSON.stringify({
    isEnabled: s.isEnabled,
    keywords: s.keywords,
    channels: s.channels,
    allowlist: s.allowlist || [],
    hideShorts: s.hideShorts,
    enableThumbnailAI: s.enableThumbnailAI,
    filterStyle: s.filterStyle,
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeFocusFilter);
} else {
  initializeFocusFilter();
}
