import { StorageService } from '../services/storage';

console.log('[Focus Filter] Background Service Worker initialized.');

// Listen for extension installation or update
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log(`[Focus Filter] Extension lifecycle event: ${details.reason}`);

  if (details.reason === 'install') {
    // Ensure default settings are written into chrome.storage.local
    const settings = await StorageService.getSettings();
    console.log('[Focus Filter] Initialized default settings:', settings);
  }
});
