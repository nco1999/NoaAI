import { BackgroundStudio } from "@/components/background-studio/BackgroundStudio";

export default function BackgroundsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">רקעים</h1>
        <p className="text-sm text-neutral-500">
          רקעי מצגת מקצועיים ונקיים, עם מקום פנוי לטקסט — לא איורים סתמיים.
        </p>
      </div>
      <BackgroundStudio />
    </div>
  );
}
