import Anthropic from "@anthropic-ai/sdk";
import type {
  UserPreferences,
  Listing,
  RankedListing,
  CommuteResult,
  ClaudeModel,
} from "../types";
import { useAppStore } from "../state";
import { searchListings } from "../tools/searchListings";
import { getCommute } from "../tools/getCommute";
import { SYSTEM_PROMPT } from "./systemPrompt";

// JSON-Schema for the ranking output. Wrapped in an envelope object because
// `output_config.format` requires a top-level object schema. Numerical and
// length constraints (`minimum`, `maxLength`, etc.) are not supported by the
// structured-outputs validator — see shared/tool-use-concepts.md.
const RANKED_LISTINGS_SCHEMA = {
  type: "object",
  properties: {
    rankings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          listing_id: { type: "string" },
          fit_score: { type: "number" },
          binding_constraint: { type: ["string", "null"] },
          rationale_one_liner: { type: "string" },
          commute_min: { type: "number" },
          commute_route: { type: "string" },
        },
        required: [
          "listing_id",
          "fit_score",
          "binding_constraint",
          "rationale_one_liner",
          "commute_min",
          "commute_route",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["rankings"],
  additionalProperties: false,
} as const;

export class ClaudeAgent {
  private client: Anthropic;
  private modelName: ClaudeModel;

  constructor(apiKey: string, model: ClaudeModel) {
    // dangerouslyAllowBrowser is required for client-side use; the user's key
    // is stored in browser state. The SDK adds the
    // anthropic-dangerous-direct-browser-access header automatically.
    this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    this.modelName = model;
  }

  private log(direction: "user_to_llm" | "llm_to_user", text: string) {
    const store = useAppStore.getState();
    if (direction === "user_to_llm") {
      store.appendUserToLLM(text);
    } else {
      store.appendLLMToUser(text);
    }
  }

  private extractText(message: Anthropic.Message): string {
    for (const block of message.content) {
      if (block.type === "text") return block.text;
    }
    return "";
  }

  private async generateText(
    userPrompt: string,
    opts?: { maxTokens?: number; thinking?: boolean },
  ): Promise<string> {
    this.log("user_to_llm", userPrompt);
    const response = await this.client.messages.create({
      model: this.modelName,
      max_tokens: opts?.maxTokens ?? 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      ...(opts?.thinking ? { thinking: { type: "adaptive" } } : {}),
    });
    const text = this.extractText(response);
    this.log("llm_to_user", text);
    return text;
  }

  private async generateRankings(userPrompt: string): Promise<RankedListing[]> {
    this.log("user_to_llm", userPrompt);
    // Cast: the SDK's MessageCreateParams type hasn't been published with the
    // GA output_config field yet; the wire format is correct on Opus 4.7 /
    // Sonnet 4.6 / Haiku 4.5.
    //
    // No adaptive thinking here: the JSON-Schema output constraint already
    // enforces a valid response shape, and on Sonnet 4.6 thinking can eat the
    // full max_tokens budget before any text is emitted (stop_reason: max_tokens).
    // 8192 tokens is enough for ~10 ranked listings with rationales.
    const params = {
      model: this.modelName,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      output_config: {
        format: { type: "json_schema", schema: RANKED_LISTINGS_SCHEMA },
      },
    } as unknown as Anthropic.MessageCreateParamsNonStreaming;
    const response = await this.client.messages.create(params);
    const text = this.extractText(response);
    this.log("llm_to_user", text);
    if (!text.trim()) {
      throw new Error(
        `Claude returned no text content (stop_reason: ${response.stop_reason}). ` +
          `If stop_reason is "refusal", try a different model or rephrase your preferences.`,
      );
    }
    const parsed = JSON.parse(text) as { rankings: RankedListing[] };
    return parsed.rankings;
  }

  async runSearchAndRank(
    prefs: UserPreferences,
  ): Promise<{ listings: Listing[]; ranked: RankedListing[] }> {
    const allListings = await searchListings(prefs);

    // No listings → don't waste a Claude call. The UI shows a no-results banner.
    if (allListings.length === 0) {
      return { listings: [], ranked: [] };
    }

    const commuteResults: Map<string, CommuteResult> = new Map();
    await Promise.all(
      allListings.map(async (listing) => {
        const result = await getCommute(listing.address, prefs.office_address);
        commuteResults.set(listing.id, result);
      }),
    );

    const surviving = allListings.filter((listing) => {
      const c = commuteResults.get(listing.id);
      return c ? c.duration_min <= prefs.commute_max_min : true;
    });

    if (surviving.length === 0) {
      return { listings: [], ranked: [] };
    }

    const listingsWithCommute = surviving.map((l) => ({
      ...l,
      commute: commuteResults.get(l.id) ?? null,
    }));

    const userPrompt = [
      "User preferences:",
      JSON.stringify(prefs, null, 2),
      "",
      `${surviving.length} listings survived filters (commute ≤ ${prefs.commute_max_min} min):`,
      JSON.stringify(listingsWithCommute, null, 2),
      "",
      "Rank up to 20 listings, ordered by fit_score descending. If fewer than 20 viable candidates exist, return what you have.",
    ].join("\n");

    const ranked = await this.generateRankings(userPrompt);
    return { listings: surviving, ranked };
  }

  async draftOutreach(
    listing: Listing,
    prefs: UserPreferences,
  ): Promise<string> {
    const prompt = [
      "Draft a short outreach message (≤ 120 words) for this listing on behalf of the user.",
      "Reference at least one specific detail (price, neighborhood, amenity, or available date).",
      "Do not claim anything you cannot verify. Be warm and concise.",
      "",
      "Listing:",
      JSON.stringify(listing, null, 2),
      "",
      "User preferences:",
      JSON.stringify(prefs, null, 2),
      "",
      "Return ONLY the message text — no subject line, no markdown.",
    ].join("\n");

    return await this.generateText(prompt, { maxTokens: 1024 });
  }

  async refineMessage(
    _listingId: string,
    instruction: string,
    current: string,
  ): Promise<string> {
    const prompt = [
      "Revise the following outreach message according to the user's instruction.",
      "Return ONLY the revised message text, no commentary.",
      "",
      "Current message:",
      current,
      "",
      "Instruction:",
      instruction,
    ].join("\n");

    return await this.generateText(prompt, { maxTokens: 1024 });
  }

  async refineSearch(
    instruction: string,
    currentRanked: RankedListing[],
    currentListings: Listing[],
  ): Promise<RankedListing[]> {
    const prompt = [
      "The user wants to re-rank the current listings based on a new instruction.",
      "Do NOT add new listings. Re-rank from the provided set only.",
      "",
      "User instruction:",
      instruction,
      "",
      "Current rankings:",
      JSON.stringify(currentRanked, null, 2),
      "",
      "Available listings:",
      JSON.stringify(currentListings, null, 2),
    ].join("\n");

    return await this.generateRankings(prompt);
  }
}
