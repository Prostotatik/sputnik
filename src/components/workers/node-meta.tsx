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
  sync: { icon: Layers, color: "#a1a1a6", tile: "#232325", kind: "Расписание", agent: "Планировщик" },
  fetch_games: { icon: Globe, color: "#a1a1a6", tile: "#232325", kind: "Обход Metacritic", agent: "Веб-агент" },
  parse_game: { icon: FileText, color: "#a1a1a6", tile: "#232325", kind: "Данные Metacritic", agent: "Metacritic API" },
  similar: { icon: Search, color: "#a1a1a6", tile: "#232325", kind: "Похожесть", agent: "Эмбеддинги" },
  critic_summary: { icon: Star, color: "#a1a1a6", tile: "#232325", kind: "ИИ-сводка", agent: "Агент отзывов" },
  user_summary: { icon: MessagesSquare, color: "#a1a1a6", tile: "#232325", kind: "ИИ-сводка", agent: "Агент отзывов" },
  youtube_search: { icon: Search, color: "#a1a1a6", tile: "#232325", kind: "Поиск на YouTube", agent: "Поиск YouTube" },
  transcribe: { icon: AudioLines, color: "#a1a1a6", tile: "#232325", kind: "Речь в текст", agent: "Распознавание речи" },
  letsplay_summary: { icon: Sparkles, color: "#a1a1a6", tile: "#232325", kind: "ИИ-вердикт", agent: "Агент выводов" },
  insights: { icon: ChartColumnIncreasing, color: "#a1a1a6", tile: "#232325", kind: "Инсайты рынка", agent: "Агент-аналитик" },
  custom_prompt: { icon: Wand2, color: "#a1a1a6", tile: "#232325", kind: "Своё правило", agent: "Агент промптов" },
};

export const STATUS_META: Record<NodeStatus | "idle", { label: string; color: string }> = {
  idle: { label: "Ожидает", color: "#85858b" },
  queued: { label: "В очереди", color: "#85858b" },
  running: { label: "Работает", color: "#4fb6c8" },
  success: { label: "Готово", color: "#4cc38a" },
  failed: { label: "Ошибка", color: "#e5484d" },
  skipped: { label: "Пропущен", color: "#5c5c62" },
};

export function YoutubeGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 20" className={className} aria-hidden>
      <rect x="1" y="1" width="26" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M11 6l7 4-7 4z" fill="currentColor" />
    </svg>
  );
}
