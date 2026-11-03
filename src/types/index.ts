export interface FilterSettings {
  isEnabled: boolean;
  keywords: string[];
  channels: string[];
  hideShorts: boolean;
  enableThumbnailAI: boolean;
  stats: {
    videosHiddenCount: number;
    thumbnailsScannedCount: number;
    lastActiveDate?: string;
  };
}

export const DEFAULT_SETTINGS: FilterSettings = {
  isEnabled: true,
  keywords: ['perfume', 'fragrance', 'cologne'],
  channels: [],
  hideShorts: false,
  enableThumbnailAI: true,
  stats: {
    videosHiddenCount: 0,
    thumbnailsScannedCount: 0,
  },
};

export type MessageType =
  | 'GET_SETTINGS'
  | 'SETTINGS_UPDATED'
  | 'INCREMENT_HIDDEN_COUNT'
  | 'OCR_REQUEST'
  | 'OCR_RESPONSE'
  | 'PING';

export interface ExtensionMessage<T = unknown> {
  type: MessageType;
  payload?: T;
}
