export type UserRole = "admin" | "developer" | "viewer";
export type AssetType = "icon" | "background" | "outline";
export type AssetVisibility = "private" | "org";

// `type` (not `interface`) so these structurally satisfy postgrest-js's
// `Record<string, unknown>`-bound `Row`/`Insert`/`Update` constraints below —
// interfaces aren't assignable to index-signature types in TS.
export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
};

export type IconGenerationParams = {
  prompt: string;
  colors: string[];
  monochrome: boolean;
  style: "outline" | "filled" | "duotone";
  strokeWidth: number;
  canvasSize: 24 | 48 | 64;
  variationCount: number;
};

export type IconVariation = {
  id: string;
  svg: string;
};

export type BackgroundAspectRatio = "16:9" | "4:3" | "1:1" | "9:16";
export type BackgroundTextZone = "right" | "left" | "center" | "top" | "none";
export type BackgroundStyle = "minimal" | "geometric" | "gradient" | "tech" | "organic";
export type BackgroundDensity = "minimal" | "balanced" | "rich";

export type BackgroundGenerationParams = {
  prompt: string;
  aspectRatio: BackgroundAspectRatio;
  textZone: BackgroundTextZone;
  style: BackgroundStyle;
  density: BackgroundDensity;
  color: string | null;
};

export type BackgroundVariation = {
  id: string;
  /** data: URI (base64 PNG) for immediate preview, before it's ever saved to Storage. */
  dataUrl: string;
  width: number;
  height: number;
};

export type Asset = {
  id: string;
  owner_id: string;
  type: AssetType;
  title: string;
  description: string | null;
  prompt: string | null;
  generation_params: Record<string, unknown>;
  content: Record<string, unknown>;
  storage_path: string | null;
  visibility: AssetVisibility;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string; email: string };
        Update: Partial<Profile>;
        Relationships: [];
      };
      assets: {
        Row: Asset;
        Insert: Partial<Asset> & { owner_id: string; type: AssetType; title: string };
        Update: Partial<Asset>;
        Relationships: [];
      };
      tags: {
        Row: { id: string; name: string };
        Insert: { id?: string; name: string };
        Update: { name?: string };
        Relationships: [];
      };
      asset_tags: {
        Row: { asset_id: string; tag_id: string };
        Insert: { asset_id: string; tag_id: string };
        Update: { asset_id?: string; tag_id?: string };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
