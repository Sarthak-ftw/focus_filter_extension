import React, { useState, useEffect } from 'react';
import { Shield, ShieldAlert, Plus, X, EyeOff, Sparkles, CheckCircle2 } from 'lucide-react';
import { StorageService } from '../services/storage';
import { FilterSettings, DEFAULT_SETTINGS } from '../types';

export const App: React.FC = () => {
  const [settings, setSettings] = useState<FilterSettings>(DEFAULT_SETTINGS);
  const [newKeyword, setNewKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [savedFeedback, setSavedFeedback] = useState(false);

  useEffect(() => {
    // Load initial settings from chrome.storage.local
    StorageService.getSettings().then((loaded) => {
      setSettings(loaded);
      setLoading(false);
    });

    // Listen for live changes
    const unsubscribe = StorageService.onSettingsChange((updated) => {
      setSettings(updated);
    });

    return () => unsubscribe();
  }, []);

  const handleToggleActive = async () => {
    const updated = { ...settings, isEnabled: !settings.isEnabled };
    setSettings(updated);
    await StorageService.saveSettings(updated);
    triggerSaved();
  };

  const handleAddKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newKeyword.trim().toLowerCase();
    if (!trimmed || settings.keywords.includes(trimmed)) return;

    const updated: FilterSettings = {
      ...settings,
      keywords: [...settings.keywords, trimmed],
    };

    setSettings(updated);
    setNewKeyword('');
    await StorageService.saveSettings(updated);
    triggerSaved();
  };

  const handleRemoveKeyword = async (keywordToRemove: string) => {
    const updated: FilterSettings = {
      ...settings,
      keywords: settings.keywords.filter((k) => k !== keywordToRemove),
    };

    setSettings(updated);
    await StorageService.saveSettings(updated);
    triggerSaved();
  };

  const triggerSaved = () => {
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 1200);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-slate-50 text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

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
      <div className="mt-3.5 mb-4">
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
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Filtered</span>
            <EyeOff className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-bold text-slate-900">
            {settings.stats.videosHiddenCount}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Videos blocked</p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Keywords</span>
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-bold text-slate-900">
            {settings.keywords.length}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Active triggers</p>
        </div>
      </div>

      {/* Keyword Manager */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-xs mb-3">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
            Blocked Keywords
          </h2>
          <span className="text-[11px] text-slate-400">Case-insensitive</span>
        </div>

        {/* Input Form */}
        <form onSubmit={handleAddKeyword} className="flex gap-1.5 mb-3">
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            placeholder="e.g. perfume, gaming, shorts..."
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

        {/* Keywords Pill List */}
        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
          {settings.keywords.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-2 text-center w-full">
              No blocked keywords yet. Add one above!
            </p>
          ) : (
            settings.keywords.map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200/70 border border-slate-200 text-slate-700 rounded-md text-xs font-medium transition group"
              >
                <span>{kw}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveKeyword(kw)}
                  className="text-slate-400 hover:text-red-500 transition-colors focus:outline-none"
                  title={`Remove "${kw}"`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))
          )}
        </div>
      </div>

      {/* Footer Info */}
      <footer className="text-center pt-2 border-t border-slate-200/60">
        <p className="text-[10px] text-slate-400">
          Focus Filter v0.1.0 • Manifest V3 • Ready for Level 1
        </p>
      </footer>
    </div>
  );
};
