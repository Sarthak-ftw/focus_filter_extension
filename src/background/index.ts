import { StorageService } from '../services/storage';

console.log('[Focus Filter] Background Service Worker initialized.');

const FOCUS_ALARM_NAME = 'focus-session-alarm';

// Extension lifecycle handler
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log(`[Focus Filter] Extension lifecycle event: ${details.reason}`);

  if (details.reason === 'install') {
    const settings = await StorageService.getSettings();
    console.log('[Focus Filter] Initialized default settings:', settings);
  }
});

// Alarm listener for persistent Focus Mode countdowns
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === FOCUS_ALARM_NAME) {
    console.log('[Focus Filter] Focus Session timer ended!');

    const settings = await StorageService.getSettings();
    if (settings.focusSession && settings.focusSession.isActive) {
      const updated = {
        ...settings,
        focusSession: {
          ...settings.focusSession,
          isActive: false,
        },
        stats: {
          ...settings.stats,
          sessionsCompleted: settings.stats.sessionsCompleted + 1,
        },
      };

      await StorageService.saveSettings(updated);
      console.log('[Focus Filter] Focus session completed & saved to storage.');
    }
  }
});

// Reactively watch for focus session start/stop in storage to set/clear chrome.alarms
StorageService.onSettingsChange((settings) => {
  if (settings.focusSession && settings.focusSession.isActive) {
    const remainingMs = settings.focusSession.endTime - Date.now();
    if (remainingMs > 0) {
      chrome.alarms.create(FOCUS_ALARM_NAME, {
        when: settings.focusSession.endTime,
      });
      console.log(
        `[Focus Filter] Chrome Alarm scheduled for ${new Date(
          settings.focusSession.endTime
        ).toLocaleTimeString()}`
      );
    }
  } else {
    chrome.alarms.clear(FOCUS_ALARM_NAME);
  }
});
