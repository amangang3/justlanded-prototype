import { useState, type FormEvent } from "react";
import { useAppStore } from "../state";
import type { City, UserPreferences } from "../types";

const REQUIREMENT_OPTIONS = [
  { value: "in_unit_laundry", label: "In-unit laundry" },
  { value: "private_bedroom", label: "Private bedroom" },
  { value: "pets_ok", label: "Pets OK" },
  { value: "dedicated_workspace", label: "Dedicated workspace" },
  { value: "gym", label: "Gym" },
  { value: "parking", label: "Parking" },
] as const;

interface PreferencesFormProps {
  onSubmit?: () => void;
}

export default function PreferencesForm({ onSubmit }: PreferencesFormProps) {
  const prefs = useAppStore((s) => s.prefs);
  const setPrefs = useAppStore((s) => s.setPrefs);

  const [collapsed, setCollapsed] = useState(false);

  // Form state
  const [city, setCity] = useState<City | "">(prefs?.city ?? "");
  const [officeAddress, setOfficeAddress] = useState(prefs?.office_address ?? "");
  const [startDate, setStartDate] = useState(prefs?.start_date ?? "");
  const [endDate, setEndDate] = useState(prefs?.end_date ?? "");
  const [budgetMaxUsd, setBudgetMaxUsd] = useState<number | "">(prefs?.budget_max_usd ?? "");
  const [commuteMaxMin, setCommuteMaxMin] = useState<number>(prefs?.commute_max_min ?? 30);
  const [furnished, setFurnished] = useState(prefs?.furnished ?? true);
  const [requirements, setRequirements] = useState<string[]>(prefs?.requirements ?? []);
  const [preferencesFreetext, setPreferencesFreetext] = useState(prefs?.preferences_freetext ?? "");

  const [errors, setErrors] = useState<Record<string, string>>({});

  function toggleRequirement(value: string) {
    setRequirements((prev) =>
      prev.includes(value) ? prev.filter((r) => r !== value) : [...prev, value],
    );
  }

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!city) errs.city = "City is required.";
    if (!officeAddress.trim()) errs.office_address = "Office address is required.";
    if (!startDate) errs.start_date = "Move-in date is required.";
    if (!endDate) errs.end_date = "Move-out date is required.";
    if (budgetMaxUsd === "" || budgetMaxUsd <= 0) errs.budget_max_usd = "Budget is required.";
    return errs;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const assembled: UserPreferences = {
      city: city as City,
      office_address: officeAddress.trim(),
      start_date: startDate,
      end_date: endDate,
      budget_max_usd: Number(budgetMaxUsd),
      commute_max_min: commuteMaxMin,
      furnished,
      requirements,
      preferences_freetext: preferencesFreetext.trim(),
    };

    setPrefs(assembled);
    setCollapsed(true);
    onSubmit?.();
  }

  // Collapsed summary
  if (collapsed && prefs) {
    const abbrev = prefs.city === "San Francisco" ? "SF" : "NYC";
    const fmt = (d: string) => {
      const [, m, day] = d.split("-");
      return `${m}/${day}`;
    };
    const summary = `${abbrev} · $${prefs.budget_max_usd.toLocaleString()} · ${prefs.commute_max_min} min commute · ${fmt(prefs.start_date)}–${fmt(prefs.end_date)}`;

    return (
      <div className="max-w-xl mx-auto flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
        <span className="text-sm text-gray-700">{summary}</span>
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="ml-4 text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          Edit
        </button>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

  return (
    <form onSubmit={handleSubmit} className="max-w-xl mx-auto flex flex-col gap-4">
      {/* 1. City */}
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-gray-700">City</legend>
        <div className="flex gap-4">
          {(["San Francisco", "New York"] as const).map((c) => (
            <label key={c} className="flex items-center gap-1.5 text-sm text-gray-700">
              <input
                type="radio"
                name="city"
                value={c}
                checked={city === c}
                onChange={() => setCity(c)}
                className="accent-blue-600"
              />
              {c}
            </label>
          ))}
        </div>
        {errors.city && <p className="mt-1 text-xs text-red-600">{errors.city}</p>}
      </fieldset>

      {/* 2. Office address */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Office address</label>
        <input
          type="text"
          value={officeAddress}
          onChange={(e) => setOfficeAddress(e.target.value)}
          placeholder="e.g. 1 Market St, San Francisco"
          className={inputClass}
        />
        {errors.office_address && (
          <p className="mt-1 text-xs text-red-600">{errors.office_address}</p>
        )}
      </div>

      {/* 3. Move-in date */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Move-in date</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className={inputClass}
        />
        {errors.start_date && <p className="mt-1 text-xs text-red-600">{errors.start_date}</p>}
      </div>

      {/* 4. Move-out date */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Move-out date</label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className={inputClass}
        />
        {errors.end_date && <p className="mt-1 text-xs text-red-600">{errors.end_date}</p>}
      </div>

      {/* 5. Monthly budget */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Monthly budget (USD)</label>
        <input
          type="number"
          value={budgetMaxUsd}
          onChange={(e) => setBudgetMaxUsd(e.target.value === "" ? "" : Number(e.target.value))}
          min={0}
          className={inputClass}
        />
        <p className="mt-1 text-xs text-gray-500">Total all-in including utilities</p>
        {errors.budget_max_usd && (
          <p className="mt-1 text-xs text-red-600">{errors.budget_max_usd}</p>
        )}
      </div>

      {/* 6. Max commute */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Max commute (min)</label>
        <input
          type="number"
          value={commuteMaxMin}
          onChange={(e) => setCommuteMaxMin(Number(e.target.value))}
          min={0}
          className={inputClass}
        />
      </div>

      {/* 7. Furnished */}
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={furnished}
          onChange={(e) => setFurnished(e.target.checked)}
          className="accent-blue-600 h-4 w-4"
        />
        Furnished required
      </label>

      {/* 8. Hard requirements — pill chips */}
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-gray-700">Hard requirements</legend>
        <div className="flex flex-wrap gap-2">
          {REQUIREMENT_OPTIONS.map(({ value, label }) => {
            const selected = requirements.includes(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggleRequirement(value)}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                  selected
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* 9. Anything else */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Anything else</label>
        <textarea
          rows={3}
          value={preferencesFreetext}
          onChange={(e) => setPreferencesFreetext(e.target.value)}
          className={inputClass}
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Find me housing
      </button>
    </form>
  );
}
