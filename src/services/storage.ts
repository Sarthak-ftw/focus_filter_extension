import { FilterSettings, DEFAULT_SETTINGS } from '../types';

const STORAGE_KEY = 'focus_filter_settings';

/**
 * Storage Service: Abstracts chrome.storage.local with type-safe methods.
 * Provides fallback to window.localStorage when testing directly in a web browser.
 */
export const StorageService = {
  /**
   * Retrieves user filter settings from chrome.storage.local.
   * If no settings exist yet, saves and returns DEFAULT_SETTINGS.
   */
  async getSettings(): Promise<FilterSettings> {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEY], (result) => {
          if (result && result[STORAGE_KEY]) {
            resolve({ ...DEFAULT_SETTINGS, ...result[STORAGE_KEY] });
          } else {
            // First time launch: initialize storage with defaults
            chrome.storage.local.set({ [STORAGE_KEY]: DEFAULT_SETTINGS }, () => {
              resolve(DEFAULT_SETTINGS);
            });
          }
        });
      });
    }

    // Fallback for standalone browser testing / Vite preview
    const local = localStorage.getItem(STORAGE_KEY);
    if (local) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(local) };
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
    return DEFAULT_SETTINGS;
  },

  /**
   * Updates settings in chrome.storage.local.
   */
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

  /**
   * Listens for changes to storage. Useful for content scripts and popups.
   */
  onSettingsChange(callback: (newSettings: FilterSettings) => void): () => void {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      const listener = (
        changes: { [key: string]: chrome.storage.StorageChange },
        areaName: string
      ) => {
        if (areaName === 'local' && changes[STORAGE_KEY]) {
          callback({ ...DEFAULT_SETTINGS, ...changes[STORAGE_KEY].newValue });
        }
      };

      chrome.storage.onChanged.addListener(listener);
      return () => chrome.storage.onChanged.removeListener(listener);
    }

    // No-op for non-extension environment
    return () => {};
  },
};
