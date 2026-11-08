/** Parses JSON from model output, tolerating markdown fences and surrounding prose. */
export function parseModelJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.search(/[[{]/);
    if (start === -1) throw new Error("No JSON found in model output");
    const open = candidate[start];
    const close = open === "{" ? "}" : "]";
    const end = candidate.lastIndexOf(close);
    if (end <= start) throw new Error("Unterminated JSON in model output");
    return JSON.parse(candidate.slice(start, end + 1));
  }
}
