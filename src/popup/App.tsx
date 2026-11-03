import React, { useState, useEffect } from 'react';
import {
  Shield,
  Plus,
  X,
  EyeOff,
  Sparkles,
  CheckCircle2,
  Film,
  RotateCcw,
  ScanEye,
  Timer,
  Play,
  Square,
  Layers,
  Award,
} from 'lucide-react';
import { StorageService } from '../services/storage';
import { FilterSettings, DEFAULT_SETTINGS, FilterStyle } from '../types';

export const App: React.FC = () => {
  const [settings, setSettings] = useState<FilterSettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<'keywords' | 'channels' | 'allowlist'>('keywords');
  const [newItem, setNewItem] = useState('');
  const [customMinutes, setCustomMinutes] = useState('25');
  const [timeLeft, setTimeLeft] = useState<string>('00:00');
  const [loading, setLoading] = useState(true);
  const [savedFeedback, setSavedFeedback] = useState(false);

  useEffect(() => {
    // Load initial settings
    StorageService.getSettings().then((loaded) => {
      setSettings(loaded);
      setLoading(false);
    });

    // Listen for live updates across browser storage
    const unsubscribe = StorageService.onSettingsChange((updated) => {
      setSettings(updated);
    });

    return () => unsubscribe();
  }, []);

  // Persistent Countdown Timer logic
  useEffect(() => {
    const updateTimer = () => {
      if (!settings.focusSession || !settings.focusSession.isActive) {
        setTimeLeft('00:00');
        return;
      }

      const diffMs = settings.focusSession.endTime - Date.now();
      if (diffMs <= 0) {
        setTimeLeft('00:00');
        return;
      }

      const totalSec = Math.floor(diffMs / 1000);
      const minutes = Math.floor(totalSec / 60);
      const seconds = totalSec % 60;
      setTimeLeft(
        `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [settings.focusSession]);

  const triggerSaved = () => {
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 1200);
  };

  const handleToggleActive = async () => {
    const updated = { ...settings, isEnabled: !settings.isEnabled };
    setSettings(updated);
    await StorageService.saveSettings(updated);
    triggerSaved();
  };

  const handleToggleShorts = async () => {
    const updated = { ...settings, hideShorts: !settings.hideShorts };
    setSettings(updated);
    await StorageService.saveSettings(updated);
    triggerSaved();
  };

  const handleToggleThumbnailAI = async () => {
    const updated = { ...settings, enableThumbnailAI: !settings.enableThumbnailAI };
    setSettings(updated);
    await StorageService.saveSettings(updated);
    triggerSaved();
  };

  const handleFilterStyleChange = async (style: FilterStyle) => {
    const updated = { ...settings, filterStyle: style };
    setSettings(updated);
    await StorageService.saveSettings(updated);
    triggerSaved();
  };

  // Focus Session Controls
  const handleStartSession = async (durationMinutes: number) => {
    const now = Date.now();
    const endTime = now + durationMinutes * 60 * 1000;

    const updated: FilterSettings = {
      ...settings,
      isEnabled: true, // Focus session automatically turns protection ON
      focusSession: {
        isActive: true,
        startTime: now,
        durationMinutes,
        endTime,
        sessionHiddenCount: 0,
      },
    };

    setSettings(updated);
    await StorageService.saveSettings(updated);
    triggerSaved();
  };

  const handleStopSession = async () => {
    const updated: FilterSettings = {
      ...settings,
      focusSession: {
        ...settings.focusSession,
        isActive: false,
      },
    };

    setSettings(updated);
    await StorageService.saveSettings(updated);
    triggerSaved();
  };

  const handleResetCount = async () => {
    const updated: FilterSettings = {
      ...settings,
      stats: { ...settings.stats, videosHiddenCount: 0 },
    };
    setSettings(updated);
    await StorageService.saveSettings(updated);
    triggerSaved();
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newItem.trim().toLowerCase();
    if (!trimmed) return;

    let updated: FilterSettings;

    if (activeTab === 'keywords') {
      if (settings.keywords.includes(trimmed)) return;
      updated = { ...settings, keywords: [...settings.keywords, trimmed] };
    } else if (activeTab === 'channels') {
      if (settings.channels.includes(trimmed)) return;
      updated = { ...settings, channels: [...settings.channels, trimmed] };
    } else {
      if (settings.allowlist?.includes(trimmed)) return;
      updated = { ...settings, allowlist: [...(settings.allowlist || []), trimmed] };
    }

    setSettings(updated);
    setNewItem('');
    await StorageService.saveSettings(updated);
    triggerSaved();
  };

  const handleRemoveItem = async (itemToRemove: string) => {
    let updated: FilterSettings;

    if (activeTab === 'keywords') {
      updated = {
        ...settings,
        keywords: settings.keywords.filter((k) => k !== itemToRemove),
      };
    } else if (activeTab === 'channels') {
      updated = {
        ...settings,
        channels: settings.channels.filter((c) => c !== itemToRemove),
      };
    } else {
      updated = {
        ...settings,
        allowlist: (settings.allowlist || []).filter((c) => c !== itemToRemove),
      };
    }

    setSettings(updated);
    await StorageService.saveSettings(updated);
    triggerSaved();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-slate-50 text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const currentList =
    activeTab === 'keywords'
      ? settings.keywords
      : activeTab === 'channels'
      ? settings.channels
      : settings.allowlist || [];

  const isSessionActive = settings.focusSession?.isActive;

  return (
    <div className="w-full bg-slate-50 text-slate-800 p-3.5 font-sans select-none max-w-[400px]">
      {/* Header */}
      <header className="flex items-center justify-between pb-2.5 border-b border-slate-200">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-sm">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-slate-900 leading-none">
              Focus Filter
            </h1>
            <p className="text-[10px] text-slate-500 mt-0.5">Study & Productivity Suite</p>
          </div>
        </div>

        {/* Master Toggle */}
        <button
          onClick={handleToggleActive}
          className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${
            settings.isEnabled ? 'bg-indigo-600' : 'bg-slate-300'
          }`}
          title={settings.isEnabled ? 'Disable Filtering' : 'Enable Filtering'}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              settings.isEnabled ? 'translate-x-5' : 'translate-x-1'
            }`}
          />
        </button>
      </header>

      {/* FOCUS MODE HERO BANNER */}
      <div className="mt-2.5 mb-2.5">
        <div
          className={`rounded-xl p-3 border transition-all ${
            isSessionActive
              ? 'bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white border-indigo-700 shadow-md'
              : 'bg-white border-slate-200/90 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-1.5">
              <Timer
                className={`w-4 h-4 ${
                  isSessionActive ? 'text-indigo-300 animate-pulse' : 'text-indigo-600'
                }`}
              />
              <span className="text-xs font-bold uppercase tracking-wider">
                {isSessionActive ? 'Focus Session Active' : 'Start Focus Session'}
              </span>
            </div>
            {isSessionActive && (
              <span className="text-sm font-mono font-bold tracking-wider bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-500/30 text-indigo-200">
                {timeLeft}
              </span>
            )}
          </div>

          {isSessionActive ? (
            <div className="flex items-center justify-between pt-1">
              <p className="text-[11px] text-indigo-200">
                Filtering all distraction triggers until timer finishes.
              </p>
              <button
                onClick={handleStopSession}
                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition shrink-0 ml-2 shadow-xs"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>End</span>
              </button>
            </div>
          ) : (
            <div>
              <p className="text-[11px] text-slate-500 mb-2">
                Choose a session duration to silence YouTube distractions:
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleStartSession(25)}
                  className="flex-1 py-1 px-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 text-indigo-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition"
                >
                  <Play className="w-2.5 h-2.5 fill-current" />
                  <span>25m</span>
                </button>
                <button
                  onClick={() => handleStartSession(50)}
                  className="flex-1 py-1 px-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 text-indigo-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition"
                >
                  <Play className="w-2.5 h-2.5 fill-current" />
                  <span>50m</span>
                </button>
                <div className="flex items-center bg-slate-100 rounded-lg border border-slate-200 px-1.5 py-0.5">
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(e.target.value)}
                    className="w-8 text-xs bg-transparent text-center font-semibold focus:outline-none text-slate-700"
                  />
                  <span className="text-[10px] text-slate-400 mr-1">m</span>
                  <button
                    onClick={() => handleStartSession(parseInt(customMinutes) || 30)}
                    className="p-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition"
                    title="Start custom timer"
                  >
                    <Play className="w-2.5 h-2.5 fill-current" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* STATS OVERVIEW GRID */}
      <div className="grid grid-cols-3 gap-2 mb-2.5">
        <div className="bg-white border border-slate-200/80 rounded-xl p-2.5 shadow-xs relative">
          <div className="flex items-center justify-between text-slate-400 mb-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider">Filtered</span>
            <EyeOff className="w-3 h-3" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-base font-bold text-slate-900">
              {settings.stats.videosHiddenCount}
            </span>
            {settings.stats.videosHiddenCount > 0 && (
              <button
                onClick={handleResetCount}
                className="text-[9px] text-slate-400 hover:text-indigo-600 transition"
                title="Reset counter"
              >
                <RotateCcw className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
          <p className="text-[9px] text-slate-400">Total blocked</p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-xl p-2.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider">Triggers</span>
            <Sparkles className="w-3 h-3" />
          </div>
          <div className="text-base font-bold text-slate-900">
            {settings.keywords.length + settings.channels.length}
          </div>
          <p className="text-[9px] text-slate-400">Rules active</p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-xl p-2.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider">Sessions</span>
            <Award className="w-3 h-3 text-amber-500" />
          </div>
          <div className="text-base font-bold text-slate-900">
            {settings.stats.sessionsCompleted || 0}
          </div>
          <p className="text-[9px] text-slate-400">Completed</p>
        </div>
      </div>

      {/* FILTER STYLE SELECTOR (BLUR VS COMPLETELY HIDE) */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-2.5 shadow-xs mb-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
            <Layers className="w-3 h-3 text-indigo-600" />
            <span>Filter Behavior</span>
          </span>
          {savedFeedback && (
            <span className="flex items-center text-[10px] font-semibold text-emerald-600 space-x-0.5">
              <CheckCircle2 className="w-3 h-3" />
              <span>Saved</span>
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-1.5 p-0.5 bg-slate-100 rounded-lg">
          <button
            onClick={() => handleFilterStyleChange('blur')}
            className={`py-1 text-xs font-semibold rounded-md transition ${
              settings.filterStyle === 'blur'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Blur with Reveal
          </button>
          <button
            onClick={() => handleFilterStyleChange('hide')}
            className={`py-1 text-xs font-semibold rounded-md transition ${
              settings.filterStyle === 'hide'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Completely Hide
          </button>
        </div>
      </div>

      {/* TOGGLES ROW (SHORTS & AI OCR) */}
      <div className="grid grid-cols-2 gap-2 mb-2.5">
        {/* Shorts Toggle */}
        <div className="bg-white border border-slate-200/80 rounded-xl px-2.5 py-2 shadow-xs flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <Film className="w-3.5 h-3.5 text-rose-500" />
            <span className="text-[11px] font-semibold text-slate-800">Shorts</span>
          </div>
          <button
            onClick={handleToggleShorts}
            className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
              settings.hideShorts ? 'bg-rose-500' : 'bg-slate-300'
            }`}
          >
            <span
              className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${
                settings.hideShorts ? 'translate-x-3.5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {/* AI OCR Toggle */}
        <div className="bg-white border border-slate-200/80 rounded-xl px-2.5 py-2 shadow-xs flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <ScanEye className="w-3.5 h-3.5 text-indigo-600" />
            <span className="text-[11px] font-semibold text-slate-800">Thumbnail AI</span>
          </div>
          <button
            onClick={handleToggleThumbnailAI}
            className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
              settings.enableThumbnailAI ? 'bg-indigo-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${
                settings.enableThumbnailAI ? 'translate-x-3.5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* TABS: KEYWORDS vs CHANNELS vs ALLOWLIST */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-2.5 shadow-xs mb-2">
        <div className="flex border-b border-slate-200 pb-1.5 mb-2 gap-2 text-[11px]">
          <button
            onClick={() => setActiveTab('keywords')}
            className={`pb-0.5 font-semibold transition ${
              activeTab === 'keywords'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Keywords ({settings.keywords.length})
          </button>
          <button
            onClick={() => setActiveTab('channels')}
            className={`pb-0.5 font-semibold transition ${
              activeTab === 'channels'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Channels ({settings.channels.length})
          </button>
          <button
            onClick={() => setActiveTab('allowlist')}
            className={`pb-0.5 font-semibold transition ${
              activeTab === 'allowlist'
                ? 'text-emerald-600 border-b-2 border-emerald-600'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Allowlist ({(settings.allowlist || []).length})
          </button>
        </div>

        {/* Input Form */}
        <form onSubmit={handleAddItem} className="flex gap-1 mb-2">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder={
              activeTab === 'keywords'
                ? 'e.g. perfume, gaming, unboxing...'
                : activeTab === 'channels'
                ? 'e.g. FragranceOne, TechHub...'
                : 'e.g. Khan Academy, MIT...'
            }
            className="flex-1 px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1.5 focus:ring-indigo-500 focus:bg-white text-slate-800 placeholder-slate-400 transition"
          />
          <button
            type="submit"
            className={`px-2.5 py-1 text-white rounded-lg text-xs font-semibold flex items-center gap-0.5 transition shadow-xs ${
              activeTab === 'allowlist'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            <Plus className="w-3 h-3" />
            <span>Add</span>
          </button>
        </form>

        {/* Chips List */}
        <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto pr-0.5">
          {currentList.length === 0 ? (
            <p className="text-[11px] text-slate-400 italic py-1.5 text-center w-full">
              No entries in {activeTab}. Add one above!
            </p>
          ) : (
            currentList.map((item) => (
              <span
                key={item}
                className={`inline-flex items-center gap-1 px-2 py-0.5 border text-slate-700 rounded-md text-[11px] font-medium transition ${
                  activeTab === 'allowlist'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-slate-100 border-slate-200'
                }`}
              >
                <span>{item}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveItem(item)}
                  className="text-slate-400 hover:text-red-500 transition-colors focus:outline-none"
                  title={`Remove "${item}"`}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))
          )}
        </div>
      </div>

      {/* Footer Info */}
      <footer className="text-center pt-1 border-t border-slate-200/60">
        <p className="text-[9px] text-slate-400">
          Focus Filter Level 3 • Focus Mode & Allowlist Active
        </p>
      </footer>
    </div>
  );
};
