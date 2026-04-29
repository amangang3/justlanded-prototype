import { useAppStore } from "../state";
import { ClaudeAgent } from "./claude";

let instance: ClaudeAgent | null = null;
let lastKey = "";
let lastModel = "";

export function getAgent(): ClaudeAgent {
  const { anthropicApiKey, model } = useAppStore.getState().settings;

  if (!anthropicApiKey) {
    throw new Error(
      "Anthropic API key not set — open Settings tab to add one",
    );
  }

  if (!instance || anthropicApiKey !== lastKey || model !== lastModel) {
    instance = new ClaudeAgent(anthropicApiKey, model);
    lastKey = anthropicApiKey;
    lastModel = model;
  }

  return instance;
}
