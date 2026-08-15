# סטודיו הדרכה — Training Studio

פלטפורמת web ליצירת תוצרי הדרכה באמצעות AI: אייקוני SVG, רקעים, ומתווים/מערכי שיעור,
עם ריבוי משתמשים והרשאות, ספרייה משותפת, והיסטוריית יצירה.

זהו שלד עבודה (MVP) הבנוי לפי מסלול הפיתוח המומלץ באפיון: קודם סכימת DB ותשתית
Next.js + Supabase, ואז מודול האייקונים, ואז מודול הרקעים — שניהם end-to-end. מודול
המתווים/מערכי השיעור עדיין "בקרוב" — הבא בתור.

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
- **מודול רקעים (end-to-end)** — רקעי מצגת מקצועיים, לא illustration:
  - פרומפט טקסטואלי, יחס גובה-רוחב (16:9 ברירת מחדל שמתאים ישירות לשקופיית PowerPoint/Slides,
    גם 4:3/1:1/9:16), אזור פנוי לטקסט (ימין/שמאל/מרכז/עליון/ללא העדפה — מתורגם להנחיית
    קומפוזיציה), סגנון, רמת עומס, צבע מוביל אופציונלי, 1–4 וריאציות
  - כל וריאציה נוצרת בקריאה **נפרדת ומקבילית** ומוצגת ברגע שהיא מוכנה (לא ממתינים לכל הסבב) —
    כל כרטיס עם loading state עצמאי
  - שמירה לספרייה מעלה קובץ תמונה אמיתי ל-Supabase Storage (לא URL זמני של הספק)
  - הורדה, יצירה מחדש, refine (מבוסס על `images/edit` של OpenAI כשאפשר — עורך את התמונה
    הקיימת בפועל, לא מייצר מחדש מאפס), הוספת וריאציה
  - הודעות שגיאה קריאות (API key / quota / timeout / content policy) — לא JSON גולמי
- **ספריית נכסים** — חיפוש, סינון לפי סוג/scope, תצוגת gallery; רקעים מוצגים כתמונה אמיתית
  (Signed URL פרטי מה-Storage), לא רק תווית
- **ניהול משתמשים** — Admin יכול לראות ולשנות הרשאות
- **מודול מתווים/מערכי שיעור** — placeholder בלבד, לשלב הבא

## הרצה מקומית

### 1. Supabase

1. צרו פרויקט חדש ב-https://supabase.com
2. הריצו את כל הקבצים שבתיקייה `supabase/migrations/` **לפי סדר** (SQL editor בפרויקט, או
   `supabase db push` אם עובדים עם ה-CLI):
   - `0001_init.sql` יוצר `profiles` (role: admin/developer/viewer) + טריגר שיוצר פרופיל
     אוטומטית בהרשמה (המשתמש הראשון בארגון הופך אוטומטית ל-admin), `assets`, `tags`,
     `asset_tags`, `collections`, `collection_assets` + RLS policies, ו-bucket פרטי בשם
     `assets` ב-Storage עם policies תואמות
   - `0002_fix_storage_object_read_policy.sql` מתקן באג RLS אמיתי (ראו "פתרון תקלות" למטה) —
     **חובה להריץ גם אותו** על כל פרויקט שכבר הוקם עם `0001_init.sql` הישן, גם אם ה-DB כבר
     פעיל. המיגרציה אידמפוטנטית (בטוח להריץ יותר מפעם אחת)
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
    api/                # /api/generate/icon, /api/generate/background, /api/assets
    login/ signup/ auth/ # מסכי אימות (Supabase Auth)
  components/
    icon-studio/        # טופס פרומפט, כרטיסי וריאציה
    background-studio/  # טופס פרומפט, כרטיסי תוצאה (loading/error/done per slot)
    library/            # גלריית הנכסים, SaveToLibraryForm המשותף (אייקונים+רקעים)
    layout/ admin/ ui/
  lib/
    ai/                 # openai.ts (OpenAI Image API, משותף לאייקונים+רקעים),
                         # icon-generation.ts, icon-params.ts, background-params.ts,
                         # rate-limiting
    svg/                # vectorize (raster→SVG לאייקונים), validate, normalize,
                         # sanitize, colorize (client-side recolor), rasterize (PNG export)
    supabase/           # קליינטים (browser/server/admin), storage.ts (upload), טיפוסי DB
    auth/                # current user + role helpers
    download.ts          # הורדת קבצים בצד לקוח (משותף)
    background-aspect.ts # מיפוי יחס-גובה-רוחב ↔ CSS aspect-ratio
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

## מודול רקעים — הערות טכניות

**Generation pipeline**: `prompt + controls → buildBackgroundPrompt (lib/ai/openai.ts) → GPT
Image (gpt-image-2, size מדויק ליחס הגובה-רוחב) → PNG (base64) → תצוגה מקדימה מיידית בדפדפן`.
כל וריאציה היא קריאה **נפרדת** ל-`/api/generate/background` (לא batch יחיד עם `n`), כי המטרה
הייתה שכל כרטיס יתעדכן ברגע שהוא מוכן — עם קריאה אחת מרובת-תמונות כל הכרטיסים ממתינים יחד
לתגובה אחת. הקליינט (`BackgroundStudio.tsx`) יורה N בקשות מקביליות ומעדכן state per-slot
כשכל אחת מתיישבת (resolve/reject) בנפרד — לא streaming protocol, רק fetch מקביל רגיל.

**גדלים לפי יחס**: `16:9→1536x864, 4:3→1536x1152, 1:1→1024x1024, 9:16→864x1536` — כל המידות
מתחלקות ב-16 ובאותו יחס בדיוק (gpt-image-2 תומך ב-WIDTHxHEIGHT חופשי בתנאים אלו), כך ש-16:9
נכנס לשקופיית PowerPoint רחבה בלי crop.

**Refine**: קורא ל-`POST /v1/images/edits` עם התמונה הקיימת (multipart/form-data) ופרומפט
שינוי ממוקד — זו עריכת-תמונה אמיתית של OpenAI, לא regeneration מאפס, כדי לשמור המשכיות
ויזואלית עם המקור. אם קריאת ה-edit נכשלת מכל סיבה, יש נפילה אוטומטית ל-generation מלא עם
הפרומפט המקורי + טקסט השיפור (כדי ש-refine לעולם לא ייכשל רק כי endpoint העריכה לא זמין).

**שמירה ל-Library**: `POST /api/assets` (אותו endpoint של אייקונים) מקבל `imageBase64` —
לאחר יצירת שורת ה-asset מעלה את הקובץ ל-Storage תחת `${owner_id}/${asset_id}/image.png`
(אותה תשתית RLS/bucket שכבר קיימת לאייקונים) ומעדכן את `storage_path`. כישלון העלאה מוחק את
השורה שנוצרה כדי לא להשאיר asset "שבור" בלי קובץ. הצגה/הורדה מה-Library משתמשות ב-Signed URL
שנוצר ישירות מהדפדפן (`supabase.storage.from('assets').createSignedUrl(...)`) — לא נדרש route
נוסף בשרת, כי ה-RLS policies על `storage.objects` שכבר קיימות מאפשרות את זה ישירות.

**מגבלת בדיקה**: אין `OPENAI_API_KEY` פעיל בסביבת הפיתוח הזו — לא הרצתי קריאה חיה ל-GPT Image
או ל-`images/edit`, ולכן לא בדקתי בפועל את 6 הפרומפטים המבוקשים מול המודל האמיתי. מה שכן
נבדק בפועל: כל שכבת ה-UI (טפסים, responsive grid, loading/error states per-card, RTL) מול
נתוני מוק אמיתיים דרך React הריאלי (לא רק code review) — ראו היסטוריית ה-commits. יש להריץ את
6 הפרומפטים ידנית ברגע שיש מפתח, ולוודא בעין את איכות ה-composition/negative space בפועל.

**Limitations נוספות**:
- כל וריאציה = קריאה נפרדת ל-OpenAI (לא batch) — עלות/latency גבוהים יותר מקריאת `n` יחידה,
  אבל זה המחיר של progressive reveal אמיתי.
- ה-`textZone`/`style`/`density`/`color` הם הנחיות טקסטואליות למודל, לא אילוץ גאומטרי מוחלט —
  אין ערובה שהאזור המבוקש יישאר ריק ב-100% מהמקרים (בניגוד לאייקונים, שם יש ולידציה מבנית
  אמיתית על ה-SVG; לתמונת רקע רסטרית אין דרך שקולה לאכוף "האזור הזה ריק" מלבד הפרומפט עצמו).
- אין עדיין moderation/content-policy handling מעבר להעברת שגיאת ה-API כפי שהיא מסווגת.

## פתרון תקלות: "new row violates row-level security policy" בשמירת רקע

**התסמין**: generation עובד, אבל שמירה לספרייה נכשלת ב-`POST /api/assets` עם 500 בזמן ה-upload
ל-Storage, וב-log השרת רואים `new row violates row-level security policy for table "objects"`.

**הסיבה**: מדובר בבאג chicken-and-egg אמיתי ב-RLS, לא בבעיית auth/ownership. ה-policy המקורי
של `SELECT` על `storage.objects` דרש שורת `assets` תואמת שבה `storage_path` כבר שווה לנתיב
האובייקט. אבל `uploadAssetFile` מעלה את הקובץ **לפני** ש-`storage_path` מתעדכן (`POST
/api/assets` קודם יוצר את שורת ה-asset, אז מעלה את הקובץ, ורק אז מעדכן `storage_path`). Supabase
Storage מבצע את ה-upload כ-`INSERT ... RETURNING`, ו-PostgreSQL מיישם את ה-`SELECT` policy גם על
השורה שחוזרת מ-`RETURNING` — כך שאף שורת `assets` לא יכלה להתאים באותו רגע (כי `storage_path`
עדיין `null`), וההעלאה הראשונה של כל asset נכשלה תמיד, גם לרקעים פרטיים וגם למשותפים לארגון.

**התיקון**: `storage/migrations/0002_fix_storage_object_read_policy.sql` (וגם עודכן ב-
`0001_init.sql` כדי שהקמה חדשה תקבל את הגרסה הנכונה מההתחלה). ה-policy החדש מאפשר לבעלים לקרוא
תמיד אובייקטים תחת התיקייה שלו (`(storage.foldername(name))[1] = auth.uid()`), **בלי תלות**
במצב טבלת ה-assets — קריאה חוצה-משתמשים (משותף לארגון / admin) עדיין עוברת דרך טבלת ה-assets
כמו קודם. RLS נשאר דלוק, ה-bucket נשאר private — שום דבר לא בוטל, רק תוקן ה-policy עצמו. נוספה
גם policy ל-`UPDATE` (הייתה חסרה לגמרי) עבור המקרה ש-`upsert:true` נתקל בהתנגשות path.

**אימות**: הרצתי migration 0001 המקורי (עם ה-policy הישן) מול Postgres 16 אמיתי מקומי (לא
Supabase, אבל אותו מנוע RLS) עם סימולציה של `storage.objects`/`auth.uid()`/`storage.foldername`,
ושחזרתי את השגיאה המדויקת שדיווחת עליה, מילה במילה, בשלב ה-`INSERT ... RETURNING` לרקע פרטי
**וגם** לרקע משותף לארגון. לאחר מכן הרצתי את אותו תרחיש בדיוק מול ה-policy המתוקן: שמירת רקע
פרטי הצליחה, קריאה חוזרת של הבעלים הצליחה (מדמה Signed URL/הורדה), משתמש אחר לא הצליח לקרוא
רקע פרטי, רקע "משותף לארגון" נקרא בהצלחה ע"י משתמש אחר, שמירת אייקון (בלי קובץ בכלל) המשיכה
לעבוד ללא שינוי, וניסיון של משתמש להעלות/לעדכן קובץ בתיקייה של משתמש אחר נחסם כראוי. גם בדקתי
של-INSERT policy הקיים אכן יש `(storage.foldername(name))[1] = auth.uid()::text` — הוא היה תקין
מלכתחילה ולא שונה.

**אם ה-migration לא רץ אוטומטית על הפרויקט הקיים שלך**, הריצי את ה-SQL הבא ב-SQL Editor של
Supabase (זהה בדיוק לתוכן `0002_fix_storage_object_read_policy.sql`, בטוח להריץ יותר מפעם אחת):

```sql
drop policy if exists "read storage objects for accessible assets" on storage.objects;

create policy "read storage objects for accessible assets"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'assets'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or is_admin()
      or exists (
        select 1 from assets a
        where a.storage_path = storage.objects.name
          and a.visibility = 'org'
      )
    )
  );

drop policy if exists "owners can update their own storage objects" on storage.objects;

create policy "owners can update their own storage objects"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
```

## Roadmap

1. ~~סכימת DB + שלד Next.js/Supabase~~
2. ~~מודול אייקוני SVG end-to-end (Claude-authored SVG)~~
3. ~~מודול אייקוני SVG: מעבר ל-hybrid pipeline (GPT Image + vectorization)~~
4. ~~מודול רקעים end-to-end (GPT Image + Storage + Library)~~
5. מודול מתווים/מערכי שיעור (פלט מובנה, עורך עשיר, ייצוא Word/PDF/Markdown)
6. עמוד Admin מורחב: מפתחות API, מעקב עלויות/שימוש
7. Session refresh אוטומטי (proxy.ts) אם נדרש רענון בכל בקשה
