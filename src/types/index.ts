export interface FocusSession {
  isActive: boolean;
  startTime: number;
  durationMinutes: number;
  endTime: number;
  sessionHiddenCount: number;
}

export type FilterStyle = 'hide' | 'blur';

export interface FilterSettings {
  isEnabled: boolean;
  keywords: string[];
  channels: string[];
  allowlist: string[];
  hideShorts: boolean;
  enableThumbnailAI: boolean;
  filterStyle: FilterStyle;
  focusSession: FocusSession;
  stats: {
    videosHiddenCount: number;
    thumbnailsScannedCount: number;
    sessionsCompleted: number;
    lastActiveDate?: string;
  };
}

export const DEFAULT_SETTINGS: FilterSettings = {
  isEnabled: true,
  keywords: ['perfume', 'fragrance', 'cologne'],
  channels: [],
  allowlist: ['mit opencourseware', 'crashcourse', 'khan academy', 'freecodecamp'],
  hideShorts: false,
  enableThumbnailAI: false, // Default to false so basic keyword filtering runs with zero overhead/stutter
  filterStyle: 'blur', // Defaults to blur with reveal so users can see the feature in action
  focusSession: {
    isActive: false,
    startTime: 0,
    durationMinutes: 30,
    endTime: 0,
    sessionHiddenCount: 0,
  },
  stats: {
    videosHiddenCount: 0,
    thumbnailsScannedCount: 0,
    sessionsCompleted: 0,
  },
};

export type MessageType =
  | 'GET_SETTINGS'
  | 'SETTINGS_UPDATED'
  | 'INCREMENT_HIDDEN_COUNT'
  | 'START_FOCUS_SESSION'
  | 'STOP_FOCUS_SESSION'
  | 'PING'
  | 'ANALYZE_THUMBNAIL';

export interface ExtensionMessage<T = unknown> {
  type: MessageType;
  payload?: T;
}
