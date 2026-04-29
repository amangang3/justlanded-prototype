import { useAppStore } from "../state";

export default function QALogTab() {
  const qaLog = useAppStore((s) => s.qaLog);

  const userEntries = qaLog.filter((e) => e.direction === "user_to_llm");
  const llmEntries = qaLog.filter((e) => e.direction === "llm_to_user");

  const userText = userEntries.map((e) => e.text).join("\n\n---\n\n");
  const llmText = llmEntries.map((e) => e.text).join("\n\n---\n\n");

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  if (qaLog.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500">
        No interactions logged yet. Use the Search tab to generate some.
      </div>
    );
  }

  return (
    <div className="space-y-4 py-4">
      {/* Stats line */}
      <p className="text-sm text-gray-600">
        {userEntries.length} user turns &middot; {llmEntries.length} LLM
        responses
      </p>

      {/* Two panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* User -> LLM */}
        <div className="rounded border border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
            <h3 className="text-sm font-semibold text-gray-700">
              User &rarr; LLM
            </h3>
            <button
              type="button"
              onClick={() => copyToClipboard(userText)}
              className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-300"
            >
              Copy all
            </button>
          </div>
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap p-4 text-sm text-gray-800">
            {userText || "(no user turns)"}
          </pre>
        </div>

        {/* LLM -> User */}
        <div className="rounded border border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
            <h3 className="text-sm font-semibold text-gray-700">
              LLM &rarr; User
            </h3>
            <button
              type="button"
              onClick={() => copyToClipboard(llmText)}
              className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-300"
            >
              Copy all
            </button>
          </div>
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap p-4 text-sm text-gray-800">
            {llmText || "(no LLM responses)"}
          </pre>
        </div>
      </div>

      {/* Helper text */}
      <p className="text-xs text-gray-400 text-center">
        Paste these into the Anthropic token counter to compute average
        input/output tokens for the cost analysis section of the write-up.
      </p>
    </div>
  );
}
