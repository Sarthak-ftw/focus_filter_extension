/**
 * Centralized YouTube DOM Selectors Dictionary.
 * Isolating selectors guarantees that any future changes to YouTube's markup
 * require editing only this single configuration file.
 */

export const YOUTUBE_SELECTORS = {
  // Video Cards across all YouTube views
  cards: [
    'ytd-rich-item-renderer',       // Homepage & Subscriptions grid cards
    'ytd-video-renderer',           // Search results cards
    'ytd-compact-video-renderer',   // Watch page "Up Next" / Suggested sidebar cards
    'ytd-reel-item-renderer',       // Individual Shorts cards
    'ytd-grid-video-renderer',      // Channel videos tab grid cards
  ].join(','),

  // Shorts containers and shelves
  shortsShelves: [
    'ytd-reel-shelf-renderer',             // Dedicated Shorts reel section
    'ytd-rich-shelf-renderer[is-shorts]',  // Homepage Shorts shelf
  ].join(','),

  // Title elements inside a video card
  titles: [
    '#video-title',
    '#video-title-link',
    'yt-formatted-string#video-title',
    'span#video-title',
    'a#video-title',
    'h3.title-and-badge',
  ].join(','),

  // Channel name elements inside a video card
  channels: [
    'ytd-channel-name #text',
    '#channel-name #text',
    '.ytd-channel-name a',
    'yt-formatted-string.ytd-channel-name',
  ].join(','),
};
