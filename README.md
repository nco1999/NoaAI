# סטודיו הדרכה — Training Studio

פלטפורמת web ליצירת תוצרי הדרכה באמצעות AI: אייקוני SVG, רקעים, ומתווים/מערכי שיעור,
עם ריבוי משתמשים והרשאות, ספרייה משותפת, והיסטוריית יצירה.

זהו שלד עבודה (MVP) הבנוי לפי מסלול הפיתוח המומלץ באפיון: קודם סכימת DB ותשתית
Next.js + Supabase, ואז מודול האייקונים בנוי end-to-end. מודולי הרקעים והמתווים
הם עדיין "בקרוב" — הבא בתור.

## Stack

- **Frontend:** Next.js 16 (App Router, Turbopack) + React 19 + TypeScript + Tailwind CSS v4
- **Backend:** Next.js Route Handlers + Server Actions
- **DB / Auth / Storage:** [Supabase](https://supabase.com) (Postgres + RLS, Auth, Storage)
- **AI (icons):** Anthropic Claude — כותב קוד SVG וקטורי (לא מודל תמונות), מוגש דרך endpoint
  שרת כדי שהמפתח לעולם לא ייחשף בצד לקוח

## מה קיים היום

- **הרשאות תפקידים** — Admin / Developer / Viewer, נאכף גם ב‑RLS וגם באפליקציה
- **מודול אייקוני SVG (end-to-end)**:
  - פרומפט טקסטואלי, צבע/מונוכרום, סגנון (outline/filled/duotone), עובי קו, גודל canvas
  - 1–4 וריאציות במקביל, כל אחת SVG אמיתי (viewBox אחיד, `currentColor` למונוכרום)
  - עריכת צבעים אחרי יצירה — מניפולציה על מחרוזת ה‑SVG בצד הלקוח, בלי לקרוא שוב ל‑AI
  - regenerate/refine (פרומפט המשך על אותה וריאציה)
  - הורדת SVG, הורדת PNG (128/256/512px), העתקת קוד
  - שמירה לספרייה עם תגיות ורמת שיתוף (פרטי / משותף לארגון)
- **ספריית נכסים** — חיפוש, סינון לפי סוג/scope, תצוגת gallery
- **ניהול משתמשים** — Admin יכול לראות ולשנות הרשאות
- **מודולי רקעים ומתווים** — placeholder בלבד, לשלב הבא

## הרצה מקומית

### 1. Supabase

1. צרו פרויקט חדש ב-https://supabase.com
2. הריצו את המיגרציה שבתיקייה `supabase/migrations/0001_init.sql` (SQL editor בפרויקט, או
   `supabase db push` אם עובדים עם ה-CLI). היא יוצרת:
   - `profiles` (role: admin/developer/viewer) + טריגר שיוצר פרופיל אוטומטית בהרשמה
     (המשתמש הראשון בארגון הופך אוטומטית ל-admin)
   - `assets`, `tags`, `asset_tags`, `collections`, `collection_assets` + RLS policies
   - bucket פרטי בשם `assets` ב-Storage, עם policies תואמות
3. Project Settings → API: העתיקו את ה-URL, ה-anon key וה-service role key

### 2. משתני סביבה

```bash
cp .env.example .env.local
```

מלאו את `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, ו-`ANTHROPIC_API_KEY` (מ-https://console.anthropic.com).

### 3. התקנה והרצה

```bash
npm install
npm run dev
```

פתחו http://localhost:3000 — הרשמה יוצרת משתמש admin ראשון אוטומטית (ראו סעיף Supabase למעלה).

### בדיקות

```bash
npm run build   # type-check + build
npm run lint    # eslint
```

## מבנה הפרויקט

```
src/
  app/
    (dashboard)/        # מוגן ב-auth: icons, backgrounds, outlines, library, admin
    api/                # /api/generate/icon, /api/assets
    login/ signup/ auth/ # מסכי אימות (Supabase Auth)
  components/
    icon-studio/        # טופס פרומפט, כרטיסי וריאציה, שמירה לספרייה
    library/            # גלריית הנכסים
    layout/ admin/ ui/
  lib/
    ai/                 # קריאות ל-Claude, ולידציה, rate limiting
    svg/                # מניפולציית צבעים, sanitize, rasterize ל-PNG
    supabase/           # קליינטים (browser/server/admin), טיפוסי DB
    auth/                # current user + role helpers
supabase/migrations/     # סכימת ה-DB וה-RLS
```

## Roadmap

1. ~~סכימת DB + שלד Next.js/Supabase~~
2. ~~מודול אייקוני SVG end-to-end~~
3. מודול רקעים (מודל תמונות, יחסי גובה-רוחב, וריאציות)
4. מודול מתווים/מערכי שיעור (פלט מובנה, עורך עשיר, ייצוא Word/PDF/Markdown)
5. עמוד Admin מורחב: מפתחות API, מעקב עלויות/שימוש
6. Session refresh אוטומטי (proxy.ts) אם נדרש רענון בכל בקשה, ו-storage signed URLs
   לקבצי רקע/ייצוא גדולים
