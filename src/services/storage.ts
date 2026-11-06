import { FilterSettings, DEFAULT_SETTINGS } from '../types';

const STORAGE_KEY = 'focus_filter_settings';

/**
 * Deep-merges stored data with defaults so that:
 * - New default fields are always present
 * - User arrays (keywords, channels, allowlist) are taken as-is from storage
 * - Nested objects (stats, focusSession) are properly merged
 */
// Safety cap: if the stored hidden count exceeds this value it was produced
// by the runaway-counter bug and should be reset to zero automatically.
const MAX_SANE_HIDDEN_COUNT = 100_000;

function mergeWithDefaults(stored: Partial<FilterSettings>): FilterSettings {
  const storedStats = stored.stats || { videosHiddenCount: 0, thumbnailsScannedCount: 0, sessionsCompleted: 0 };
  const rawCount = storedStats.videosHiddenCount ?? 0;

  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    // Explicitly preserve user-modified arrays — shallow spread would already do this,
    // but being explicit prevents accidental reset if schema grows.
    keywords: Array.isArray(stored.keywords) ? stored.keywords : DEFAULT_SETTINGS.keywords,
    channels: Array.isArray(stored.channels) ? stored.channels : DEFAULT_SETTINGS.channels,
    allowlist: Array.isArray(stored.allowlist) ? stored.allowlist : DEFAULT_SETTINGS.allowlist,
    stats: {
      ...DEFAULT_SETTINGS.stats,
      ...storedStats,
      // Auto-heal corrupted runaway counter values from the previous bug
      videosHiddenCount: rawCount > MAX_SANE_HIDDEN_COUNT ? 0 : rawCount,
    },
    focusSession: {
      ...DEFAULT_SETTINGS.focusSession,
      ...(stored.focusSession || {}),
    },
  };
}

export const StorageService = {
  async getSettings(): Promise<FilterSettings> {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEY], (result) => {
          if (result && result[STORAGE_KEY]) {
            resolve(mergeWithDefaults(result[STORAGE_KEY]));
          } else {
            chrome.storage.local.set({ [STORAGE_KEY]: DEFAULT_SETTINGS }, () => {
              resolve(DEFAULT_SETTINGS);
            });
          }
        });
      });
    }

    const local = localStorage.getItem(STORAGE_KEY);
    if (local) {
      try {
        return mergeWithDefaults(JSON.parse(local));
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
    return DEFAULT_SETTINGS;
  },

  async saveSettings(settings: FilterSettings): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ [STORAGE_KEY]: settings }, () => {
          resolve();
        });
      });
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  },

  onSettingsChange(callback: (newSettings: FilterSettings) => void): () => void {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      const listener = (
        changes: { [key: string]: chrome.storage.StorageChange },
        areaName: string
      ) => {
        if (areaName === 'local' && changes[STORAGE_KEY]) {
          callback(mergeWithDefaults(changes[STORAGE_KEY].newValue));
        }
      };

      chrome.storage.onChanged.addListener(listener);
      return () => chrome.storage.onChanged.removeListener(listener);
    }

    return () => {};
  },
};
