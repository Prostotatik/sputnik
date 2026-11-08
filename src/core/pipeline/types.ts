import { z } from "zod";

const preferredModel = z.string().max(80).default("");

function isTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Parameter schemas per node type. Keys here are the only valid node types. */
export const paramSchemas = {
  sync: z.object({
    intervalMinutes: z.number().int().min(5).max(1440).default(60),
    gamesPerRun: z.number().int().min(1).max(100).default(20),
    timezone: z.string().refine(isTimeZone, "Unknown time zone").default("Europe/Moscow"),
    requestDelayMs: z.number().int().min(0).max(10000).default(700),
  }),
  fetch_games: z.object({
    newReleasesLimit: z.number().int().min(1).max(50).default(20),
    browsePageSize: z.number().int().min(6).max(48).default(24),
    maxBrowsePages: z.number().int().min(1).max(50).default(10),
  }),
  parse_game: z.object({
    userScoresPerPlatform: z.boolean().default(true),
  }),
  critic_summary: z.object({
    maxReviews: z.number().int().min(2).max(40).default(12),
    preferredModel,
  }),
  user_summary: z.object({
    maxReviews: z.number().int().min(2).max(60).default(20),
    preferredModel,
  }),
  similar: z.object({
    topK: z.number().int().min(1).max(20).default(8),
    useEmbeddings: z.boolean().default(true),
  }),
  youtube_search: z.object({
    queryTemplate: z.string().min(3).max(200).default("{{title}} let's play"),
    minDurationMinutes: z.number().int().min(1).max(120).default(8),
    excludePattern: z
      .string()
      .max(300)
      .default("no commentary|nocommentary|no talking|without commentary|trailer|soundtrack|\\bost\\b")
      .refine((p) => {
        try {
          new RegExp(p, "i");
          return true;
        } catch {
          return false;
        }
      }, "Invalid regular expression"),
    maxCandidates: z.number().int().min(1).max(5).default(2),
    requireReviews: z.boolean().default(true),
  }),
  transcribe: z.object({
    startOffsetSec: z.number().int().min(0).max(3600).default(120),
    clipSeconds: z.number().int().min(30).max(900).default(180),
    dailyBudgetMinutes: z.number().int().min(0).max(480).default(360),
    minTranscriptChars: z.number().int().min(0).max(5000).default(200),
    preferredModel,
  }),
  letsplay_summary: z.object({ preferredModel }),
  insights: z.object({ preferredModel }),
  custom_prompt: z.object({
    fieldKey: z.string().regex(/^[a-z][a-z0-9_]{1,39}$/, "Use lowercase letters, digits, underscore"),
    label: z.string().min(1).max(60),
    requireReviews: z.boolean().default(false),
    preferredModel,
  }),
} as const;

export type NodeType = keyof typeof paramSchemas;
export const NODE_TYPES = Object.keys(paramSchemas) as NodeType[];

export type NodeParams<T extends NodeType> = z.infer<(typeof paramSchemas)[T]>;

/** Node types that call an AI model with an editable prompt. */
export const PROMPT_NODE_TYPES: NodeType[] = [
  "critic_summary",
  "user_summary",
  "transcribe",
  "letsplay_summary",
  "insights",
  "custom_prompt",
];

export interface PipelineNode<T extends NodeType = NodeType> {
  id: string;
  type: T;
  name: string;
  description: string;
  enabled: boolean;
  prompt: string | null;
  params: NodeParams<T>;
  parentId: string | null;
  sort: number;
  isCustom: boolean;
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export function isNodeType(type: string): type is NodeType {
  return type in paramSchemas;
}

export function validateParams<T extends NodeType>(
  type: T,
  params: unknown,
): ValidationResult<NodeParams<T>> {
  const parsed = paramSchemas[type].safeParse(params ?? {});
  if (parsed.success) return { ok: true, value: parsed.data as NodeParams<T> };
  return {
    ok: false,
    errors: parsed.error.issues.map((i) => `${i.path.join(".") || "params"}: ${i.message}`),
  };
}

export function validatePrompt(type: NodeType, prompt: string | null | undefined): string[] {
  if (!PROMPT_NODE_TYPES.includes(type)) return [];
  if (!prompt || prompt.trim().length < 10) return ["prompt: must be at least 10 characters"];
  if (prompt.length > 8000) return ["prompt: must be at most 8000 characters"];
  return [];
}
