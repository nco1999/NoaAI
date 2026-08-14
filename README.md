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
- **AI (icons):** hybrid pipeline — OpenAI GPT Image generates a clean monochrome raster icon,
  which is vectorized locally into SVG (no language model authors or hand-edits path
  coordinates). See "מודול אייקוני SVG" below for why. Served through a server endpoint so the
  API key never reaches the client.

## מה קיים היום

- **הרשאות תפקידים** — Admin / Developer / Viewer, נאכף גם ב‑RLS וגם באפליקציה
- **מודול אייקוני SVG (end-to-end, hybrid pipeline)**:
  - `prompt → GPT Image (raster, monochrome, transparent-ready) → vectorization → SVG cleanup`.
    ניסינו קודם לתת ל-Claude לכתוב SVG paths ישירות; זה עקבית הפיק גאומטריה עקומה/לא
    סימטרית/אנטומיה לא נכונה. יצירת אייקונים היא בעיה **ויזואלית**, ומודל תמונות + vectorizer
    דטרמיניסטי (`imagetracerjs`) פותרים אותה טוב הרבה יותר מאשר לבקש ממודל שפה "לצייר" בקוד.
    שום מודל שפה לא נוגע בקואורדינטות SVG — לא ביצירה, ולא ב"תיקון".
  - פרומפט טקסטואלי, סגנון (outline/filled/duotone → משפיע על התמונה המבוקשת), עובי קו (רמז
    לסגנון הקו בתמונה, רלוונטי בעיקר ל-outline), גודל canvas
  - עד 4 וריאציות (קריאה אחת ל-GPT Image עם `n`), כל אחת מיוקטרת בנפרד ל-SVG עם `viewBox` אחיד
    ו-`currentColor` (duotone: שתי שכבות currentColor בשתי שקיפויות)
  - עריכת צבעים אחרי יצירה — מניפולציה על מחרוזת ה‑SVG בצד הלקוח, בלי לקרוא שוב ל‑AI
  - regenerate/refine (פרומפט המשך → generation חוזר של התמונה, לא עריכת SVG ידנית)
  - הורדת SVG, הורדת PNG (128/256/512px), העתקת קוד
  - שמירה לספרייה עם תגיות ורמת שיתוף (פרטי / משותף לארגון)
  - ולידציה אמיתית בצד השרת (`lib/svg/validate.ts`): whitelist תגיות/attributes, בדיקת
    viewBox/טווח קואורדינטות/תקציב אלמנטים, איסור script/event handlers/URLs חיצוניים
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
`SUPABASE_SERVICE_ROLE_KEY`, ו-`OPENAI_API_KEY` (מ-https://platform.openai.com).

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
    ai/                 # OpenAI Image API call + prompt builder, rate limiting
    svg/                # vectorize (raster→SVG), validate, normalize, sanitize,
                         # colorize (client-side recolor), rasterize (PNG export)
    supabase/           # קליינטים (browser/server/admin), טיפוסי DB
    auth/                # current user + role helpers
supabase/migrations/     # סכימת ה-DB וה-RLS
```

## מודול אייקוני SVG — הערות טכניות

הגישה הראשונה (Claude כותב SVG paths ישירות, גם עם system prompt מפורט/self-check/repair loop)
לא הצליחה לתת גאומטריה אמינה — קווים לא מיושרים, פרופורציות/אנטומיה שגויות. המסקנה: זו לא
בעיה שפותרים עם prompt engineering טוב יותר, אלא בעיה שדורשת מנוע ויזואלי.

**ה-pipeline הנוכחי**: `GPT Image (gpt-image-2, מוגדר ב-`OPENAI_IMAGE_MODEL`) → פענוח PNG
(`pngjs`) → vectorization (`imagetracerjs`, MIT/Unlicense — לא GPL) עם פלטת צבעים קשיחה
(שחור מלא/אפור לדואוטון/רקע) ו-`colorquantcycles:1` כדי לשמר צבעים מדויקים → מיפוי לינארי
ל-`currentColor` → `validateIconSvg` כשער אחרון`.

חלק מהבקרות הקודמות (עובי קו, מונוכרום/פלטת צבעים) כבר לא מתורגמות אחד-לאחד ל-SVG — הן
משפיעות על התמונה שמתבקשת מהמודל, לא על attributes של SVG (המודל הוקטורי מפיק תמיד `fill`
מלא, לא `stroke`). זה תיעדתי בקוד ובטופס; ה-UI לבחירת "מונוכרום + עד 6 צבעים" הוסר כי הוא
כבר לא עשה כלום בפועל.

**מגבלה בבדיקה**: לסביבת הפיתוח הזו אין `OPENAI_API_KEY` פעיל, אז לא הרצתי קריאה חיה ל-GPT
Image. בדקתי את שלב הוקטוריזציה/הניקוי/הוולידציה מול תמונות PNG סינתטיות (עיגול מלא, טבעת
outline, דואוטון) שנוצרו ידנית — לא מול הפלט האמיתי של המודל. יש להריץ את 5 הפרומפטים בפועל
ברגע שיש מפתח.

**אם האיכות עדיין לא מספיקה** אחרי בדיקה עם מפתח אמיתי, האלטרנטיבות הבאות (בסדר עדיפות):
1. כיוונון פרמטרי vectorization (`pathomit`/`ltres`/`qtres`/`blurradius` ב-`vectorize.ts`) —
   הכי זול, לא דורש שינוי ארכיטקטורה.
2. שיפור פרומפט התמונה (`lib/ai/openai.ts`) או מעבר ל-`quality:"high"` ברזולוציה גבוהה יותר.
3. מעבר לשירות vectorization ייעודי/מבוסס-AI (כגון Vectorizer.AI / Adobe Illustrator API) —
   איכות גבוהה יותר מפוטרייס קלאסי, אך תלות בספק חיצוני נוסף ועלות לכל בקשה.
4. הרצת דגם segmentation (כגון rembg/SAM) לפני ה-vectorization כדי לנקות רקע/artifacts טוב
   יותר מסף-צבע פשוט, אם GPT Image ימשיך להחזיר רעש ברקע גם עם prompt "flat white background".

## Roadmap

1. ~~סכימת DB + שלד Next.js/Supabase~~
2. ~~מודול אייקוני SVG end-to-end (Claude-authored SVG)~~
3. ~~מודול אייקוני SVG: מעבר ל-hybrid pipeline (GPT Image + vectorization)~~
4. מודול רקעים (GPT Image, יחסי גובה-רוחב, וריאציות) — התשתית (`lib/ai/openai.ts`) כבר קיימת
5. מודול מתווים/מערכי שיעור (פלט מובנה, עורך עשיר, ייצוא Word/PDF/Markdown)
6. עמוד Admin מורחב: מפתחות API, מעקב עלויות/שימוש
7. Session refresh אוטומטי (proxy.ts) אם נדרש רענון בכל בקשה, ו-storage signed URLs
   לקבצי רקע/ייצוא גדולים
