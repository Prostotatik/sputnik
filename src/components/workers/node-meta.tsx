import {
  AudioLines,
  ChartColumnIncreasing,
  FileText,
  Globe,
  Layers,
  MessagesSquare,
  Search,
  Sparkles,
  Star,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import type { NodeStatus } from "@/lib/db/schema";

export const NODE_META: Record<string, { icon: LucideIcon; color: string; tile: string; kind: string; agent: string }> = {
  sync: { icon: Layers, color: "#a1a1a6", tile: "#232325", kind: "Project", agent: "Scheduler" },
  fetch_games: { icon: Globe, color: "#a1a1a6", tile: "#232325", kind: "Thread", agent: "Web Agent" },
  parse_game: { icon: FileText, color: "#a1a1a6", tile: "#232325", kind: "Tool Call", agent: "Metacritic API" },
  similar: { icon: Search, color: "#a1a1a6", tile: "#232325", kind: "Read/Search", agent: "Embeddings" },
  critic_summary: { icon: Star, color: "#a1a1a6", tile: "#232325", kind: "Subagent", agent: "Review Agent" },
  user_summary: { icon: MessagesSquare, color: "#a1a1a6", tile: "#232325", kind: "Subagent", agent: "Review Agent" },
  youtube_search: { icon: Search, color: "#a1a1a6", tile: "#232325", kind: "Web", agent: "YouTube Search" },
  transcribe: { icon: AudioLines, color: "#a1a1a6", tile: "#232325", kind: "Media Tool", agent: "Speech-to-text" },
  letsplay_summary: { icon: Sparkles, color: "#a1a1a6", tile: "#232325", kind: "Subagent", agent: "Insight Agent" },
  insights: { icon: ChartColumnIncreasing, color: "#a1a1a6", tile: "#232325", kind: "Workflow Agent", agent: "Analyst Agent" },
  custom_prompt: { icon: Wand2, color: "#a1a1a6", tile: "#232325", kind: "Custom Rule", agent: "Prompt Agent" },
};

export const STATUS_META: Record<NodeStatus | "idle", { label: string; color: string }> = {
  idle: { label: "Idle", color: "#85858b" },
  queued: { label: "Queued", color: "#85858b" },
  running: { label: "Running", color: "#4fb6c8" },
  success: { label: "Done", color: "#4cc38a" },
  failed: { label: "Failed", color: "#e5484d" },
  skipped: { label: "Skipped", color: "#5c5c62" },
};

export function YoutubeGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 20" className={className} aria-hidden>
      <rect x="1" y="1" width="26" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M11 6l7 4-7 4z" fill="currentColor" />
    </svg>
  );
}
