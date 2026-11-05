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

// In-memory counter: tracks how many videos have been hidden this page session.
// Writing to storage happens only when this counter actually changes (not on every scan tick).
let localHiddenCount = 0;
let pendingStorageWrite: ReturnType<typeof setTimeout> | null = null;

/**
 * Debounced storage writer: batches rapid increments into a single storage write
 * every 1500ms. This eliminates the runaway counter loop where writing stats
 * triggered onSettingsChange → reEvaluateAll → more increments → more writes.
 */
function reportHidden(newlyHiddenThisCall: number): void {
  if (newlyHiddenThisCall <= 0) return;

  localHiddenCount += newlyHiddenThisCall;

  if (pendingStorageWrite) {
    clearTimeout(pendingStorageWrite);
  }

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
    } catch (err) {
      console.warn('[Focus Filter] Failed to persist hidden count:', err);
    }
  }, 1500);
}

async function initializeFocusFilter(): Promise<void> {
  const settings = await StorageService.getSettings();

  // 1. Pure filtering engine with allowlist
  filterEngine = new FilterEngine(
    settings.keywords,
    settings.channels,
    settings.allowlist || [],
    settings.hideShorts,
    settings.isEnabled
  );

  // 2. Thumbnail OCR scanner
  thumbnailScanner = new ThumbnailScanner(
    filterEngine,
    settings.enableThumbnailAI && settings.isEnabled,
    reportHidden
  );

  // 3. DOM scanner — passes only *new* hidden counts (not cumulative session total)
  scanner = new YouTubeScanner(
    filterEngine,
    thumbnailScanner,
    settings.filterStyle || 'blur',
    reportHidden
  );

  // 4. Mutation observer
  observer = new YouTubeObserver(scanner);
  observer.start();

  // 5. React to popup settings changes
  // IMPORTANT: We guard against infinite loops here.
  // onSettingsChange fires when stats.videosHiddenCount changes too (from reportHidden).
  // We only call reEvaluateAll when non-stats fields actually changed.
  let lastKnownRuleHash = getRuleHash(settings);

  StorageService.onSettingsChange((updatedSettings: FilterSettings) => {
    const newHash = getRuleHash(updatedSettings);

    // Always keep engine rules in sync
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

    // Only re-scan the DOM if the actual filter rules changed.
    // This prevents the stats counter write from triggering a full DOM re-scan.
    if (newHash !== lastKnownRuleHash) {
      lastKnownRuleHash = newHash;
      scanner.reEvaluateAll();
    }
  });
}

/**
 * Creates a lightweight hash string from the filter-relevant parts of settings.
 * Stats and focusSession are excluded so their updates don't trigger DOM re-scans.
 */
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
