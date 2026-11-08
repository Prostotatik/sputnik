/**
 * True for summary points that only state the absence of an opinion, like "No negative feedback"
 * or "Lacks criticism in review". Real complaints such as "No multiplayer" are kept.
 */
export function isPlaceholderPoint(text: string): boolean {
  return /^(no|none|nothing|lacks?|without|absence of)\b.*\b(negative|criticism|criticisms|complaints?|issues? (mentioned|reported|noted)|feedback|drawbacks?|downsides?|dislikes?|cons)\b/i.test(text.trim());
}

export function realPoints(points: string[]): string[] {
  return points.filter((p) => !isPlaceholderPoint(p));
}
