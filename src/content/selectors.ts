/**
 * Centralized YouTube DOM Selectors Dictionary.
 * Covers Home feed, Search results, Shorts shelves, Channel pages, and Suggested videos.
 * Supports both classic Polymer elements and modern (2024-2026) Wiz/Lit view models.
 */

export const YOUTUBE_SELECTORS = {
  // Video Cards across all YouTube views (Home, Search, Shorts Shelves, Watch Next, Subscriptions)
  cards: [
    'ytd-rich-item-renderer',              // Homepage & Subscriptions grid cards
    'ytd-video-renderer',                  // Search results standard video cards
    'ytd-compact-video-renderer',          // Watch page "Up Next" / Suggested sidebar cards
    'ytd-reel-item-renderer',              // Individual Shorts cards (classic)
    'ytd-grid-video-renderer',             // Channel videos tab grid cards
    'yt-lockup-view-model',                 // Modern universal lockup component (Home & Search)
    'ytm-shorts-lockup-view-model',         // Modern Shorts card (shelf & search results)
    'ytm-shorts-lockup-view-model-v2',      // Modern Shorts card v2
    'ytd-shorts-lockup-view-model',         // Desktop Shorts lockup
    'shorts-lockup-view-model',             // Generic Shorts lockup view model
    'grid-shelf-view-model',                // Shorts grid container cards
  ].join(','),

  // Shorts containers and shelves
  shortsShelves: [
    'ytd-reel-shelf-renderer',             // Dedicated Shorts reel section in Search & Home
    'ytd-rich-shelf-renderer[is-shorts]',  // Homepage Shorts shelf
    'grid-shelf-view-model',               // Modern grid shelf
  ].join(','),

  // Title elements inside a video card
  titles: [
    '#video-title',
    '#video-title-link',
    'yt-formatted-string#video-title',
    'span#video-title',
    'a#video-title',
    'h3.title-and-badge',
    'h3 a',
    'h3',
    '.yt-lockup-metadata-view-model-wiz__title',
    '.yt-lockup-metadata-view-model__title',
    'yt-core-attributed-string',
    'span.yt-core-attributed-string',
    'a[href*="/shorts/"]',
    'a[href*="/watch"]',
  ].join(','),

  // Channel name elements inside a video card
  channels: [
    'ytd-channel-name #text',
    '#channel-name #text',
    '.ytd-channel-name a',
    'yt-formatted-string.ytd-channel-name',
    'ytd-channel-name',
    '#channel-name',
    '.yt-lockup-metadata-view-model-wiz__metadata',
    '.yt-lockup-metadata-view-model__metadata',
    'a[href^="/@"]',
    'a[href*="/channel/"]',
  ].join(','),
};
