/**
 * True for summary points that only state the absence of an opinion, like "No negative feedback"
 * or "Lacks criticism in review". Real complaints such as "No multiplayer" are kept.
 */
export function isPlaceholderPoint(text: string): boolean {
  const t = text.trim();
  return (
    /^(no|none|nothing|lacks?|without|absence of)\b.*\b(negative|criticism|criticisms|complaints?|issues? (mentioned|reported|noted)|feedback|drawbacks?|downsides?|dislikes?|cons)\b/i.test(t) ||
    // Russian: "Нет негативных отзывов", "Отсутствие критики", "Без существенных минусов", "Никаких претензий".
    /^(нет|никаких|отсутств\p{L}*|без|не\s+(найден|отмечен|выявлен)\p{L}*)(\s|$).*(негатив|критик|жалоб|претензи|минус|недостат|замечани|отрицательн)/iu.test(t) ||
    // "Жалоб не отмечено", "Минусов нет".
    /^(жалоб|претензий|минусов|недостатков|замечаний)\s+(нет|не\s+(отмечено|найдено|выявлено))/iu.test(t)
  );
}

export function realPoints(points: string[]): string[] {
  return points.filter((p) => !isPlaceholderPoint(p));
}
