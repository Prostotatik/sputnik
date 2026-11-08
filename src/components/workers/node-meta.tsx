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
  sync: { icon: Layers, color: "#a78bfa", tile: "linear-gradient(135deg,#7c3aed,#4f46e5)", kind: "Project", agent: "Scheduler" },
  fetch_games: { icon: Globe, color: "#60a5fa", tile: "#1e3a8a", kind: "Thread", agent: "Web Agent" },
  parse_game: { icon: FileText, color: "#60a5fa", tile: "#1d4ed8", kind: "Tool Call", agent: "Metacritic API" },
  similar: { icon: Search, color: "#e5e7eb", tile: "#27272a", kind: "Read/Search", agent: "Embeddings" },
  critic_summary: { icon: Star, color: "#facc15", tile: "#3b2f0b", kind: "Subagent", agent: "Review Agent" },
  user_summary: { icon: MessagesSquare, color: "#818cf8", tile: "#312e81", kind: "Subagent", agent: "Review Agent" },
  youtube_search: { icon: Search, color: "#ef4444", tile: "#3f0d0d", kind: "Web", agent: "YouTube Search" },
  transcribe: { icon: AudioLines, color: "#e5e7eb", tile: "#27272a", kind: "Media Tool", agent: "Speech-to-text" },
  letsplay_summary: { icon: Sparkles, color: "#38bdf8", tile: "#0c4a6e", kind: "Subagent", agent: "Insight Agent" },
  insights: { icon: ChartColumnIncreasing, color: "#f43f5e", tile: "#4c0519", kind: "Workflow Agent", agent: "Analyst Agent" },
  custom_prompt: { icon: Wand2, color: "#c084fc", tile: "#3b0764", kind: "Custom Rule", agent: "Prompt Agent" },
};

export const STATUS_META: Record<NodeStatus | "idle", { label: string; color: string }> = {
  idle: { label: "Idle", color: "#71717a" },
  queued: { label: "Queued", color: "#a1a1aa" },
  running: { label: "Running", color: "#4ade80" },
  success: { label: "Done", color: "#22c55e" },
  failed: { label: "Failed", color: "#ef4444" },
  skipped: { label: "Skipped", color: "#52525b" },
};

export function YoutubeGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 20" className={className} aria-hidden>
      <rect width="28" height="20" rx="5" fill="#ff0033" />
      <path d="M11 6l7 4-7 4z" fill="white" />
    </svg>
  );
}
