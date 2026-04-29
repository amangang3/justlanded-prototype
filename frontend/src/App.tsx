import { useState, useCallback } from "react";
import { useAppStore } from "./state";
import { getAgent } from "./agent/runAgent";
import PreferencesForm from "./components/PreferencesForm";
import ResultsList from "./components/ResultsList";
import SettingsTab from "./components/SettingsTab";
import QALogTab from "./components/QALogTab";
import type { Listing } from "./types";

type Tab = "Search" | "Settings" | "QA Log";

const tabs: Tab[] = ["Search", "Settings", "QA Log"];

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("Search");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hasSearched, setHasSearched] = useState(false);

  const prefs = useAppStore((s) => s.prefs);
  const useSyntheticData = useAppStore((s) => s.settings.useSyntheticData);
  const listings = useAppStore((s) => s.listings);
  const rankedListings = useAppStore((s) => s.rankedListings);
  const setListings = useAppStore((s) => s.setListings);
  const setRankedListings = useAppStore((s) => s.setRankedListings);

  const handleSearchSubmit = useCallback(async () => {
    const currentPrefs = useAppStore.getState().prefs;
    if (!currentPrefs) return;
    setError(null);
    setIsLoading(true);
    try {
      const agent = getAgent();
      const { listings: newListings, ranked } =
        await agent.runSearchAndRank(currentPrefs);
      setListings(newListings);
      setRankedListings(ranked);
      setHasSearched(true);
    } catch (err) {
      setHasSearched(true);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [setListings, setRankedListings]);

  const handleDraftOutreach = useCallback(
    async (listing: Listing): Promise<string> => {
      const currentPrefs = useAppStore.getState().prefs;
      if (!currentPrefs) throw new Error("No preferences set");
      const agent = getAgent();
      return agent.draftOutreach(listing, currentPrefs);
    },
    [],
  );

  const handleRefineMessage = useCallback(
    async (
      listingId: string,
      instruction: string,
      current: string,
    ): Promise<string> => {
      const agent = getAgent();
      return agent.refineMessage(listingId, instruction, current);
    },
    [],
  );

  const handleRefineSearch = useCallback(
    async (text: string) => {
      setError(null);
      setIsLoading(true);
      try {
        const agent = getAgent();
        const newRanked = await agent.refineSearch(
          text,
          rankedListings,
          listings,
        );
        setRankedListings(newRanked);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    },
    [rankedListings, listings, setRankedListings],
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Just Landed AI</h1>
          <nav className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 relative">
        {/* Loading overlay */}
        {isLoading && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-white/60">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
              <span className="text-sm text-gray-600">Working...</span>
            </div>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 font-medium underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {activeTab === "Search" && (
          <div className="space-y-8">
            {/* Synthetic data banner */}
            {useSyntheticData && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                Using synthetic data for demo &mdash; toggle off in Settings to
                pull from real sources.
              </div>
            )}

            {/* No listings banner */}
            {hasSearched && listings.length === 0 && !isLoading && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                No listings returned from any source. Open browser DevTools
                &rarr; Console for per-source errors.
              </div>
            )}

            {/* How it works — shown before user has submitted preferences */}
            {!prefs && !hasSearched && (
              <div className="max-w-xl mx-auto bg-white rounded-lg border border-gray-200 p-6 mb-8">
                <h2 className="text-lg font-bold text-gray-900 mb-1">Find your summer sublet in minutes, not weeks.</h2>
                <p className="text-sm text-gray-500 mb-4">Here's how Just Landed AI works:</p>
                <ol className="space-y-3 text-sm text-gray-700 list-decimal list-inside">
                  <li><strong>Tell us what you need.</strong> Pick your city, set your budget, move-in dates, and must-haves like furnished or in-unit laundry.</li>
                  <li><strong>We search everywhere.</strong> The app pulls real listings from the Inter-MBA sublease Google Sheet, Craigslist, Zillow, RentCast, and Blueground — all at once.</li>
                  <li><strong>AI ranks your matches.</strong> Claude reads every listing, checks your commute, and scores each one on how well it fits. You get a shortlist of 3–5 top picks with plain-English explanations.</li>
                  <li><strong>Draft a message and reach out.</strong> For any listing you like, the AI writes a personalized outreach message. Edit it, refine it, copy it, send it.</li>
                </ol>
                <p className="text-xs text-gray-400 mt-4">Built for MBA and university interns moving to a new city for 10–12 weeks.</p>
              </div>
            )}

            <PreferencesForm onSubmit={handleSearchSubmit} />

            {prefs && (
              <ResultsList
                onDraftOutreach={handleDraftOutreach}
                onRefineMessage={handleRefineMessage}
                onRefineSearch={handleRefineSearch}
              />
            )}
          </div>
        )}

        {activeTab === "Settings" && <SettingsTab />}

        {activeTab === "QA Log" && <QALogTab />}
      </main>
    </div>
  );
}

export default App;
