import { IconStudio } from "@/components/icon-studio/IconStudio";

export default function IconsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">אייקוני SVG</h1>
        <p className="text-sm text-neutral-500">
          תיאור טקסטואלי → מודל שפה כותב קוד SVG וקטורי אמיתי (לא תמונה).
        </p>
      </div>
      <IconStudio />
    </div>
  );
}
