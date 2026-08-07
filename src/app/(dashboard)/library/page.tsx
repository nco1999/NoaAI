import { AssetLibrary } from "@/components/library/AssetLibrary";

export default function LibraryPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">ספריית נכסים</h1>
        <p className="text-sm text-neutral-500">חיפוש וסינון נכסים פרטיים ומשותפים לארגון.</p>
      </div>
      <AssetLibrary />
    </div>
  );
}
