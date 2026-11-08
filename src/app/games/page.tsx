import { Suspense } from "react";
import { GamesView } from "@/components/games/games-view";

export default function GamesPage() {
  return (
    <Suspense>
      <GamesView />
    </Suspense>
  );
}
