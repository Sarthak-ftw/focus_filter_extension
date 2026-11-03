import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldAlert,
  Plus,
  X,
  EyeOff,
  Sparkles,
  CheckCircle2,
  Tv,
  Film,
  RotateCcw,
} from 'lucide-react';
import { StorageService } from '../services/storage';
import { FilterSettings, DEFAULT_SETTINGS } from '../types';

export const App: React.FC = () => {
  const [settings, setSettings] = useState<FilterSettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<'keywords' | 'channels'>('keywords');
  const [newItem, setNewItem] = useState('');
  const [loading, setLoading] = useState(true);
  const [savedFeedback, setSavedFeedback] = useState(false);

  useEffect(() => {
    // Load initial settings from chrome.storage.local
    StorageService.getSettings().then((loaded) => {
      setSettings(loaded);
      setLoading(false);
    });

    // Listen for live changes across storage
    const unsubscribe = StorageService.onSettingsChange((updated) => {
      setSettings(updated);
    });

    return () => unsubscribe();
  }, []);

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
      updated = {
        ...settings,
        keywords: [...settings.keywords, trimmed],
      };
    } else {
      if (settings.channels.includes(trimmed)) return;
      updated = {
        ...settings,
        channels: [...settings.channels, trimmed],
      };
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
    } else {
      updated = {
        ...settings,
        channels: settings.channels.filter((c) => c !== itemToRemove),
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

  const currentList = activeTab === 'keywords' ? settings.keywords : settings.channels;

  return (
    <div className="w-full bg-slate-50 text-slate-800 p-4 font-sans select-none">
      {/* Header */}
      <header className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-100">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-slate-900 leading-none">
              Focus Filter
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">YouTube Distraction Shield</p>
          </div>
        </div>

        {/* Master Toggle */}
        <button
          onClick={handleToggleActive}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
            settings.isEnabled ? 'bg-indigo-600' : 'bg-slate-300'
          }`}
          title={settings.isEnabled ? 'Disable Filtering' : 'Enable Filtering'}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              settings.isEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </header>

      {/* Status Banner */}
      <div className="mt-3.5 mb-3">
        <div
          className={`flex items-center justify-between p-3 rounded-xl border text-xs transition-all ${
            settings.isEnabled
              ? 'bg-indigo-50/60 border-indigo-200/80 text-indigo-900'
              : 'bg-amber-50/70 border-amber-200 text-amber-900'
          }`}
        >
          <div className="flex items-center space-x-2">
            {settings.isEnabled ? (
              <Shield className="w-4 h-4 text-indigo-600 shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <span className="font-medium">
              {settings.isEnabled ? 'Shield Active on YouTube' : 'Filtering is Paused'}
            </span>
          </div>
          {savedFeedback && (
            <span className="flex items-center text-xs font-semibold text-emerald-600 space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Saved</span>
            </span>
          )}
        </div>
      </div>

      {/* Stats Counter */}
      <div className="grid grid-cols-2 gap-2.5 mb-3">
        <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-xs relative group">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Filtered</span>
            <EyeOff className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900">
              {settings.stats.videosHiddenCount}
            </span>
            {settings.stats.videosHiddenCount > 0 && (
              <button
                onClick={handleResetCount}
                className="text-[10px] text-slate-400 hover:text-indigo-600 transition flex items-center gap-0.5"
                title="Reset counter"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Videos suppressed</p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Triggers</span>
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-bold text-slate-900">
            {settings.keywords.length + settings.channels.length}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Active filters</p>
        </div>
      </div>

      {/* Shorts Toggle Quick Option */}
      <div className="bg-white border border-slate-200/80 rounded-xl px-3 py-2.5 shadow-xs mb-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Film className="w-4 h-4 text-rose-500" />
          <div>
            <p className="text-xs font-semibold text-slate-800">Block YouTube Shorts</p>
            <p className="text-[10px] text-slate-400">Hides distracting Shorts reels</p>
          </div>
        </div>
        <button
          onClick={handleToggleShorts}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
            settings.hideShorts ? 'bg-rose-500' : 'bg-slate-300'
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              settings.hideShorts ? 'translate-x-4.5' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Tabs: Keywords vs Channels */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-xs mb-3">
        <div className="flex border-b border-slate-200 pb-2 mb-2.5 gap-2">
          <button
            onClick={() => setActiveTab('keywords')}
            className={`pb-1 text-xs font-semibold flex items-center gap-1 transition ${
              activeTab === 'keywords'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span>Keywords ({settings.keywords.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('channels')}
            className={`pb-1 text-xs font-semibold flex items-center gap-1 transition ${
              activeTab === 'channels'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Tv className="w-3 h-3" />
            <span>Channels ({settings.channels.length})</span>
          </button>
        </div>

        {/* Input Form */}
        <form onSubmit={handleAddItem} className="flex gap-1.5 mb-2.5">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder={
              activeTab === 'keywords'
                ? 'e.g. perfume, gaming, unboxing...'
                : 'e.g. FragranceOne, GamerX...'
            }
            className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1.5 focus:ring-indigo-500 focus:bg-white text-slate-800 placeholder-slate-400 transition"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium flex items-center gap-1 transition shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </form>

        {/* List of Chips */}
        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
          {currentList.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-2 text-center w-full">
              No blocked {activeTab} yet.
            </p>
          ) : (
            currentList.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 hover:bg-slate-200/70 border border-slate-200 text-slate-700 rounded-md text-xs font-medium transition group"
              >
                <span>{item}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveItem(item)}
                  className="text-slate-400 hover:text-red-500 transition-colors focus:outline-none"
                  title={`Remove "${item}"`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))
          )}
        </div>
      </div>

      {/* Footer Info */}
      <footer className="text-center pt-1 border-t border-slate-200/60">
        <p className="text-[10px] text-slate-400">
          Focus Filter Level 1 • Live Filtering Active
        </p>
      </footer>
    </div>
  );
};
