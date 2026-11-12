/** English defaults shipped before the Russian UI. Stored rows still equal to these are upgraded on startup. */

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

export const LEGACY_CUSTOM_PROMPT = `Based on the data about "{{title}}" ({{genres}}; platforms: {{platforms}}):
{{description}}

Critic verdict: {{criticVerdict}}
Player verdict: {{userVerdict}}

Answer in at most 50 words: `;

export const LEGACY_PROMPTS: Record<string, string> = {
  reviews: CRITIC_PROMPT,
  users: USER_PROMPT,
  transcribe: TRANSCRIBE_PROMPT,
  letsplay: LETSPLAY_PROMPT,
  insights: INSIGHTS_PROMPT,
};

export const LEGACY_NODES: Record<string, { name: string; description: string }> = {
  sync: { name: "Metacritic Sync", description: "Hourly schedule, 20 new games per run, daily restart." },
  fetch: { name: "Fetch New Games", description: "New Releases first, then See All (newest) page by page, skipping games processed today." },
  parse: { name: "Parse Game Data", description: "Title, cover, platforms with Metascore/Userscore, developer, description, video." },
  similar: { name: "Find Similar Games", description: "Nearest games from the library by description, genres, developer and platforms." },
  reviews: { name: "Summarize Critics", description: "What critics like and dislike." },
  users: { name: "Summarize Players", description: "What players like and dislike." },
  youtube: { name: "YouTube Analysis", description: "Find the most viewed commentated let's-play." },
  transcribe: { name: "Transcribe Narration", description: "Speech-to-text of the blogger's narration." },
  letsplay: { name: "Let's-play Verdict", description: "Conclusion from the transcript with a link to the video." },
  insights: { name: "Generate Insights", description: "Market key insights for the Analytics tab, once per run." },
};

/** Description given to custom rules before the Russian UI. */
export const LEGACY_CUSTOM_DESCRIPTION = /^Custom field "(.*)" generated for every processed game\.$/;
