import { IconStudio } from "@/components/icon-studio/IconStudio";

export default function IconsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">אייקוני SVG</h1>
        <p className="text-sm text-neutral-500">
          תיאור טקסטואלי → GPT Image מייצר אייקון נקי → וקטוריזציה מקומית ל-SVG אמיתי.
        </p>
      </div>
      <IconStudio />
    </div>
  );
}
