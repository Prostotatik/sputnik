const SHORT: Record<string, string> = {
  "PlayStation 5": "PS5",
  "PlayStation 4": "PS4",
  "PlayStation 3": "PS3",
  "PlayStation Vita": "VITA",
  "Xbox Series X": "XSX",
  "Xbox One": "XONE",
  "Xbox 360": "X360",
  "Nintendo Switch": "SWITCH",
  "Nintendo Switch 2": "NS2",
  "Nintendo 3DS": "3DS",
  "Wii U": "WIIU",
  PC: "PC",
  "iOS (iPhone/iPad)": "iOS",
  Android: "ANDROID",
  "Meta Quest": "QUEST",
  Stadia: "STADIA",
};

/** Short badge label for a Metacritic platform name. */
export function shortPlatform(name: string): string {
  return SHORT[name] ?? name.replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase();
}
