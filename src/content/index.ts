import { StorageService } from '../services/storage';
import { FilterSettings } from '../types';

console.log(
  '%c[Focus Filter] Active on YouTube. Level 0 environment verified!',
  'background: #4f46e5; color: #ffffff; font-weight: bold; padding: 4px 8px; border-radius: 4px;'
);

// Read current settings on load
StorageService.getSettings().then((settings: FilterSettings) => {
  console.log('[Focus Filter] Current active settings loaded:', {
    enabled: settings.isEnabled,
    keywordCount: settings.keywords.length,
    keywords: settings.keywords,
  });
});

// Listen for updates made in the Popup
StorageService.onSettingsChange((updatedSettings: FilterSettings) => {
  console.log('[Focus Filter] Settings updated in real-time:', updatedSettings);
});
