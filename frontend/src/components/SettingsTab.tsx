import { useState } from "react";
import { useAppStore } from "../state";
import type { AppSettings } from "../types";

export default function SettingsTab() {
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);

  const [showAnthropic, setShowAnthropic] = useState(false);
  const [showMaps, setShowMaps] = useState(false);

  const [testStatus, setTestStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  const [gidJsonText, setGidJsonText] = useState(
    JSON.stringify(settings.interMbaExtraGids, null, 2),
  );
  const [gidJsonError, setGidJsonError] = useState<string | null>(null);

  function update(patch: Partial<AppSettings>) {
    setSettings({ ...settings, ...patch });
  }

  async function testAnthropicKey() {
    setTestStatus("loading");
    try {
      const res = await fetch("https://api.anthropic.com/v1/models", {
        headers: {
          "x-api-key": settings.anthropicApiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
      });
      setTestStatus(res.ok ? "success" : "error");
    } catch {
      setTestStatus("error");
    }
  }

  function handleGidJsonBlur() {
    try {
      const parsed = JSON.parse(gidJsonText);
      if (typeof parsed !== "object" || Array.isArray(parsed)) {
        setGidJsonError("Must be a JSON object like {\"city\": \"gid\"}");
        return;
      }
      setGidJsonError(null);
      update({ interMbaExtraGids: parsed as Record<string, string> });
    } catch {
      setGidJsonError("Invalid JSON");
    }
  }

  return (
    <div className="max-w-md mx-auto space-y-6 py-4">
      {/* Anthropic API Key */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          Anthropic API Key
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={showAnthropic ? "text" : "password"}
              value={settings.anthropicApiKey}
              onChange={(e) => update({ anthropicApiKey: e.target.value })}
              className="w-full rounded border border-gray-300 px-3 py-2 pr-16 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="sk-ant-..."
            />
            <button
              type="button"
              onClick={() => setShowAnthropic((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700"
            >
              {showAnthropic ? "Hide" : "Show"}
            </button>
          </div>
          <button
            type="button"
            onClick={testAnthropicKey}
            disabled={testStatus === "loading" || !settings.anthropicApiKey}
            className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {testStatus === "loading" ? "Testing..." : "Test key"}
          </button>
        </div>
        {testStatus === "success" && (
          <p className="text-sm text-green-600">Key is valid</p>
        )}
        {testStatus === "error" && (
          <p className="text-sm text-red-600">Key test failed</p>
        )}
        <p className="text-xs text-gray-400">
          Required to call Claude. Get one at{" "}
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            console.anthropic.com
          </a>
          .
        </p>
      </div>

      {/* Maps API Key */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          Google Maps API Key
        </label>
        <div className="relative">
          <input
            type={showMaps ? "text" : "password"}
            value={settings.mapsApiKey}
            onChange={(e) => update({ mapsApiKey: e.target.value })}
            className="w-full rounded border border-gray-300 px-3 py-2 pr-16 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Enter your Maps API key"
          />
          <button
            type="button"
            onClick={() => setShowMaps((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700"
          >
            {showMaps ? "Hide" : "Show"}
          </button>
        </div>
        <p className="text-xs text-gray-400">
          Optional — falls back to haversine estimate.
        </p>
      </div>

      {/* Model dropdown */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">Model</label>
        <select
          value={settings.model}
          onChange={(e) =>
            update({
              model: e.target.value as AppSettings["model"],
            })
          }
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="claude-haiku-4-5">claude-haiku-4-5 (recommended)</option>
          <option value="claude-sonnet-4-6">claude-sonnet-4-6</option>
          <option value="claude-opus-4-7">claude-opus-4-7 (most capable)</option>
          <option value="claude-opus-4-6">claude-opus-4-6</option>
        </select>
        <p className="text-xs text-gray-400">
          Haiku 4.5 handles ranking + outreach drafting at the lowest cost.
          Switch to Sonnet or Opus if rankings look noisy on a complex search.
        </p>
      </div>

      {/* Synthetic data toggle */}
      <div className="space-y-1">
        <label className="flex items-center gap-3 cursor-pointer">
          <div className="relative">
            <input
              type="checkbox"
              checked={settings.useSyntheticData}
              onChange={(e) => update({ useSyntheticData: e.target.checked })}
              className="sr-only peer"
            />
            <div className="h-6 w-11 rounded-full bg-gray-300 peer-checked:bg-blue-600 transition-colors" />
            <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
          </div>
          <span className="text-sm font-medium text-gray-700">
            Use synthetic data
          </span>
        </label>
        <p className="text-xs text-gray-400">
          When enabled, uses bundled mock listings for instant demos. Turn off
          to pull live results from Inter-MBA + Blueground.
        </p>
      </div>

      {/* Data sources sub-heading */}
      <h3 className="text-sm font-semibold text-gray-800 border-t border-gray-200 pt-4">
        Data Sources
      </h3>

      {/* Blueground scraper URL */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          Blueground scraper URL
        </label>
        <input
          type="text"
          value={settings.scraperUrl}
          onChange={(e) => update({ scraperUrl: e.target.value })}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="http://localhost:8000"
        />
        <p className="text-xs text-gray-400">
          Where the Python scraper API is running. Defaults to{" "}
          <code>http://localhost:8000</code>; override via{" "}
          <code>VITE_SCRAPER_URL</code> in <code>.env</code>.
        </p>
      </div>

      {/* Inter-MBA info */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          Inter-MBA Settings
        </label>
        <p className="text-xs text-gray-500">
          Inter-MBA listings are auto-discovered per city. No URL configuration
          needed. SF, NYC, Boston, Chicago, LA, DC, Seattle, Philly, Austin,
          Atlanta, and many more are built in.
        </p>
      </div>

      {/* Inter-MBA extra gid map */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          Inter-MBA city gid map (JSON)
        </label>
        <textarea
          rows={3}
          value={gidJsonText}
          onChange={(e) => setGidJsonText(e.target.value)}
          onBlur={handleGidJsonBlur}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder='{"chicago": "123456789", "boston": "987654321"}'
        />
        {gidJsonError && (
          <p className="text-sm text-red-600">{gidJsonError}</p>
        )}
        <p className="text-xs text-gray-400">
          Override or add city tab gids for cities not in the built-in map.
          Format: {`{"city_name": "gid_number"}`}
        </p>
      </div>
    </div>
  );
}
