import { paramSchemas, type NodeType, type PipelineNode } from "./types";

const CRITIC_PROMPT = `Ты анализируешь рецензии профессиональных критиков на видеоигру «{{title}}» ({{genres}}; разработчик: {{developer}}).

Рецензии (оценка из 100, затем фрагмент):
{{reviews}}

Кратко опиши, что критикам нравится и не нравится в игре. Верни 3–5 коротких плюсов (likes) и 3–5 коротких минусов (dislikes), каждый из 2–6 слов, конкретно и без цифр оценок, и вердикт одним абзацем (verdict, не больше 60 слов). Если рецензии почти единогласно хвалят игру, верни меньше минусов или ни одного. Не пиши пункты, которые лишь сообщают об отсутствии мнения, вроде «Нет негативных отзывов». Пиши на русском языке.`;

const USER_PROMPT = `Ты анализируешь отзывы игроков на видеоигру «{{title}}» ({{genres}}).

Отзывы (оценка из 10, затем фрагмент):
{{reviews}}

Кратко опиши, что игрокам нравится и не нравится. Верни 3–5 коротких плюсов (likes) и 3–5 коротких минусов (dislikes), каждый из 2–6 слов, конкретно: производительность, сложность, сюжет, монетизация и т. п., и вердикт одним абзацем (verdict, не больше 60 слов). Игнорируй спам и отзывы не по теме. Если серьёзных жалоб нет, верни пустой список минусов, а не пункты вроде «Нет негативных отзывов». Пиши на русском языке.`;

const TRANSCRIBE_PROMPT = `Дословно расшифруй, что говорит ведущий (ютубер, летсплейщик) в этом фрагменте видео, на языке оригинала, без перевода. Только речь: без описания происходящего на экране, без таймкодов и подписей говорящих. Если никто не говорит, верни пустую строку.`;

const LETSPLAY_PROMPT = `Ниже расшифровка самого популярного летсплея игры «{{title}}» с канала «{{channel}}» (видео: «{{videoTitle}}»).

Расшифровка:
{{transcript}}

Напиши вывод о том, что этот блогер думает об игре: общее впечатление, что его восхищает и что раздражает. Верни вывод (conclusion, не больше 70 слов, на русском языке, в третьем лице, например «Блогер…») и 2–4 коротких ключевых фразы (highlights) на русском.`;

const INSIGHTS_PROMPT = `Ты аналитик игрового рынка и помогаешь гейм-дизайнерам и специалистам по закупке трафика.
Вот агрегированные метрики библиотеки недавно вышедших игр с Metacritic:
{{metrics}}

Сформулируй ровно 3 ключевых инсайта (не больше 30 слов каждый) на русском языке, которые помогут выбрать жанр, платформу или позиционирование новой игры. У каждого инсайта есть тип kind: "up" (растущий спрос), "down" (спад) или "opportunity" (недооценённая ниша). Каждое утверждение опирай на приведённые цифры.`;

export const DEFAULT_CUSTOM_PROMPT = `На основе данных об игре «{{title}}» ({{genres}}; платформы: {{platforms}}):
{{description}}

Вердикт критиков: {{criticVerdict}}
Вердикт игроков: {{userVerdict}}

Ответь на русском языке, не больше 50 слов: `;

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
    node("sync", "sync", "Синхронизация с Metacritic", "Каждый час, 20 новых игр за запуск, новый отсчёт каждый день.", null, 0),
    node(
      "fetch",
      "fetch_games",
      "Отбор новых игр",
      "Сначала New Releases, затем See All (сначала новые) страница за страницей, без игр, уже обработанных сегодня.",
      "sync",
      1,
    ),
    node("parse", "parse_game", "Разбор карточки игры", "Название, обложка, платформы с Metascore и Userscore, разработчик, описание с переводом, видео.", "fetch", 2),
    node("similar", "similar", "Похожие игры", "Ближайшие игры из библиотеки по описанию, жанрам, разработчику и платформам.", "fetch", 3),
    node("reviews", "critic_summary", "Сводка критиков", "Что нравится и не нравится критикам.", "sync", 4, CRITIC_PROMPT),
    node("users", "user_summary", "Сводка игроков", "Что нравится и не нравится игрокам.", "reviews", 5, USER_PROMPT),
    node("youtube", "youtube_search", "Анализ YouTube", "Поиск самого просматриваемого летсплея с комментариями.", "sync", 6),
    node("transcribe", "transcribe", "Расшифровка речи", "Перевод речи блогера в текст.", "youtube", 7, TRANSCRIBE_PROMPT),
    node("letsplay", "letsplay_summary", "Вердикт летсплея", "Вывод по расшифровке со ссылкой на видео.", "transcribe", 8, LETSPLAY_PROMPT),
    node("insights", "insights", "Инсайты рынка", "Ключевые инсайты для вкладки «Аналитика», раз за запуск.", "reviews", 9, INSIGHTS_PROMPT),
  ];
}

/** Description of a custom rule node. */
export function customDescription(label: string): string {
  return `Своё поле «${label}» для каждой обработанной игры.`;
}

/** Replaces {{name}} placeholders; unknown placeholders become empty. */
export function renderPrompt(template: string, vars: Record<string, string | number | null | undefined>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const v = vars[key];
    return v === null || v === undefined ? "" : String(v);
  });
}
