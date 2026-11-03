export interface FilterSettings {
  isEnabled: boolean;
  keywords: string[];
  channels: string[];
  hideShorts: boolean;
  stats: {
    videosHiddenCount: number;
    lastActiveDate?: string;
  };
}

export const DEFAULT_SETTINGS: FilterSettings = {
  isEnabled: true,
  keywords: ['perfume', 'fragrance', 'cologne'],
  channels: [],
  hideShorts: false,
  stats: {
    videosHiddenCount: 0,
  },
};

export type MessageType =
  | 'GET_SETTINGS'
  | 'SETTINGS_UPDATED'
  | 'INCREMENT_HIDDEN_COUNT'
  | 'PING';

export interface ExtensionMessage<T = unknown> {
  type: MessageType;
  payload?: T;
}
