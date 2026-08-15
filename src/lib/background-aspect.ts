import type { BackgroundAspectRatio } from "@/lib/supabase/types";

/** CSS `aspect-ratio` value for each supported background aspect ratio. */
export const ASPECT_RATIO_CSS: Record<BackgroundAspectRatio, string> = {
  "16:9": "16 / 9",
  "4:3": "4 / 3",
  "1:1": "1 / 1",
  "9:16": "9 / 16",
};
