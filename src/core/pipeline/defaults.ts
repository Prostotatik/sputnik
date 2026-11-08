import { paramSchemas, type NodeType, type PipelineNode } from "./types";

const CRITIC_PROMPT = `You analyse professional critic reviews of the video game "{{title}}" ({{genres}}; developer: {{developer}}).

Reviews (score out of 100, then excerpt):
{{reviews}}

Summarise what critics like and dislike about the game. Return 3-5 short likes and 3-5 short dislikes (each 2-6 words, concrete, no score numbers) and a one-paragraph verdict (max 60 words). If reviews are almost uniformly positive, return fewer dislikes or none. Never write points that only state an absence, like "No negative feedback". Write in English.`;

const USER_PROMPT = `You analyse player (user) reviews of the video game "{{title}}" ({{genres}}).

Reviews (score out of 10, then excerpt):
{{reviews}}

Summarise what players like and dislike. Return 3-5 short likes and 3-5 short dislikes (each 2-6 words, concrete: performance, difficulty, story, monetisation, etc.) and a one-paragraph verdict (max 60 words). Ignore spam and off-topic text. If players raise no real complaints, return an empty dislikes list rather than points like "No negative feedback". Write in English.`;

const TRANSCRIBE_PROMPT = `Transcribe what the narrator (the YouTuber/let's-player) says in this video segment, verbatim, in the original language. Speech only: no descriptions of visuals, no timestamps, no speaker labels. If nobody speaks, answer with an empty string.`;

const LETSPLAY_PROMPT = `Below is a transcript of the most popular let's-play of the game "{{title}}" by the channel "{{channel}}" (video: "{{videoTitle}}").

Transcript:
{{transcript}}

Write a conclusion of what this blogger thinks about the game: overall impression, what excites them, what frustrates them. Return a conclusion (max 70 words, English, third person, e.g. "The blogger...") and 2-4 short highlight phrases.`;

const INSIGHTS_PROMPT = `You are a games market analyst helping game designers and user-acquisition specialists.
Here are aggregated metrics from a library of recently released games on Metacritic:
{{metrics}}

Write exactly 3 key insights (max 30 words each) that are actionable for choosing a genre, platform or positioning for a new game. Each insight has kind "up" (growing demand), "down" (declining) or "opportunity" (under-served niche). Base every claim on the numbers given.`;

export const DEFAULT_CUSTOM_PROMPT = `Based on the data about "{{title}}" ({{genres}}; platforms: {{platforms}}):
{{description}}

Critic verdict: {{criticVerdict}}
Player verdict: {{userVerdict}}

Answer in at most 50 words: `;

type DefaultNode = Omit<PipelineNode, "params"> & { params: Record<string, unknown> };

function node(
  id: string,
  type: NodeType,
  name: string,
  description: string,
  parentId: string | null,
  sort: number,
  prompt: string | null = null,
): DefaultNode {
  return {
    id,
    type,
    name,
    description,
    enabled: true,
    prompt,
    params: paramSchemas[type].parse({}),
    parentId,
    sort,
    isCustom: false,
  };
}

/** Default pipeline = the collection rules described in doc/TZ.md. */
export function defaultPipeline(): DefaultNode[] {
  return [
    node("sync", "sync", "Metacritic Sync", "Hourly schedule, 20 new games per run, daily restart.", null, 0),
    node(
      "fetch",
      "fetch_games",
      "Fetch New Games",
      "New Releases first, then See All (newest) page by page, skipping games processed today.",
      "sync",
      1,
    ),
    node("parse", "parse_game", "Parse Game Data", "Title, cover, platforms with Metascore/Userscore, developer, description, video.", "fetch", 2),
    node("similar", "similar", "Find Similar Games", "Nearest games from the library by description, genres, developer and platforms.", "fetch", 3),
    node("reviews", "critic_summary", "Summarize Critics", "What critics like and dislike.", "sync", 4, CRITIC_PROMPT),
    node("users", "user_summary", "Summarize Players", "What players like and dislike.", "reviews", 5, USER_PROMPT),
    node("youtube", "youtube_search", "YouTube Analysis", "Find the most viewed commentated let's-play.", "sync", 6),
    node("transcribe", "transcribe", "Transcribe Narration", "Speech-to-text of the blogger's narration.", "youtube", 7, TRANSCRIBE_PROMPT),
    node("letsplay", "letsplay_summary", "Let's-play Verdict", "Conclusion from the transcript with a link to the video.", "transcribe", 8, LETSPLAY_PROMPT),
    node("insights", "insights", "Generate Insights", "Market key insights for the Analytics tab, once per run.", "reviews", 9, INSIGHTS_PROMPT),
  ];
}

/** Replaces {{name}} placeholders; unknown placeholders become empty. */
export function renderPrompt(template: string, vars: Record<string, string | number | null | undefined>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const v = vars[key];
    return v === null || v === undefined ? "" : String(v);
  });
}
