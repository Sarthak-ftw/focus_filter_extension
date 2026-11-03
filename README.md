# focus_filter_extension

# Focus Filter — YouTube Distraction Control Extension

A personalized, intelligent YouTube distraction-filtering Chrome Extension built with Manifest V3, React 18, TypeScript, and Tailwind CSS.

## Overview

Focus Filter helps users study and learn on YouTube without falling into their personal distraction triggers (e.g., perfumes, gaming, celebrity gossip, tech reviews). Instead of blocking all of YouTube, Focus Filter identifies and hides distracting video recommendations and Shorts in real-time.

## Features & Roadmap

- [x] **Level 0**: Architecture, Manifest V3 Toolchain (Dual-Vite build), Chrome Storage API, and React Popup UI.
- [ ] **Level 1**: Real-time YouTube DOM Scanner, MutationObserver batching, and Keyword Filtering Engine.
- [ ] **Level 2**: Intelligent Thumbnail AI (OCR with Tesseract.js, browser image embeddings).
- [ ] **Level 3**: Focus Mode (Study sessions, stats, temporary reveal).
- [ ] **Level 4**: Chrome Web Store release and performance optimization.

## Tech Stack

- **Extension**: Chrome Manifest V3
- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide React
- **Build System**: Vite 6 (Dual config: standard rollup + isolated IIFE content script)
- **Storage**: Chrome Storage Local API (`chrome.storage.local`)

## Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Build the extension
```bash
npm run build
```

### 3. Load into Chrome
1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** in the top-right corner.
3. Click **Load unpacked** and select the `dist/` directory.
