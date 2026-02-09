# לוז בית-ספרי (Mobile-First, RTL)

מערכת לוז בית-ספרי לנייד בעברית מלאה (RTL), עם:

- Vite + React + TypeScript
- Tailwind CSS
- PWA
- CRUD מלא (הוספה/עריכה/מחיקה)
- LocalStorage לשינויים מקומיים בלבד
- ייבוא/ייצוא JSON
- GitHub Pages + GitHub Actions לפריסה אוטומטית על כל Commit ל-`main`

## הרצה מקומית

- התקנת תלויות: `npm install`
- הרצה: `npm run dev`
- Build: `npm run build`
- Preview: `npm run preview`

## מקור אמת (Single Source of Truth)

הקובץ [data/schedule.json](data/schedule.json) הוא מקור האמת היחיד בריפו.

התנהגות:

- האתר תמיד טוען את הנתונים מהקובץ הזה.
- אם קיימים שינויים מקומיים (LocalStorage) הם גוברים לתצוגה מקומית בלבד.
- אין כתיבה אוטומטית ל-GitHub מהדפדפן.

## עדכון לוז רשמי (GitHub)

1) באתר לחץ על ייצוא JSON.
2) החלף את התוכן של [data/schedule.json](data/schedule.json) בקובץ שהורדת.
3) בצע Commit ל-`main`.
4) GitHub Actions יבצע Build ויפרסם אוטומטית ל-GitHub Pages.

## ייבוא/ייצוא JSON

- ייבוא JSON: מעלה קובץ JSON ומחיל אותו מקומית (LocalStorage).
- מצב ייבוא:
  - החלפה מלאה
  - מיזוג לפי `id`
- איפוס שינויים מקומיים: מוחק LocalStorage וחוזר למקור האמת מהריפו.

## יבוא מגוגל שיטס (מהיום והלאה)

הייבוא מגוגל שיטס מתבצע דרך CSV, כדי לא להזדקק להתחברות.

1) ייצוא ל-CSV:

- ייצוא ידני: Google Sheets → File → Download → Comma-separated values (.csv)
- או לינק יצוא (אם הגיליון ציבורי): `.../export?format=csv`

2) הרצה:

- `npm run import:sheet -- --csv path/to/sheet.csv`

התוצאה: עדכון [data/schedule.json](data/schedule.json) עם **שורות מהתאריך של היום והלאה בלבד**.

### עמודות נתמכות ב-CSV

שמות באנגלית או בעברית:

- `date` / `תאריך` (חובה, `YYYY-MM-DD`)
- `kind` / `סוג` (חובה): `schedule` / `exam` / `holiday` (או: `לוז`/`מבחן`/`חופשה`)
- `title` / `כותרת` (חובה)
- `startTime`/`שעת התחלה`, `endTime`/`שעת סיום` (אופציונלי, `HH:MM`)
- `group`/`קבוצה`, `location`/`מקום`, `notes`/`הערות` (אופציונלי)

לפי סוג:

- `schedule`: חובה גם `type`/`סוג אירוע` = `meeting` או `trip` (או: `ישיבה`/`טיול`)
- `exam`: חובה גם `subject`/`מקצוע`
- `holiday`: חובה גם `reason`/`סיבה`

אחרי הרצה: מבצעים Commit ל-[data/schedule.json](data/schedule.json) כדי לפרסם ל-GitHub Pages.

## כללי פיתוח (חובה)

ראה [RULES.md](RULES.md) — כולל כלל חובה של הפרדה מוחלטת בין HTML ל-CSS:

- אין `<style>` בתוך [index.html](index.html)
- אין inline styles ב-React
- עיצוב רק דרך [src/index.css](src/index.css) ו-Tailwind classes

## פריסה ל-GitHub Pages

ה-workflow לפריסה נמצא ב-[.github/workflows/deploy.yml](.github/workflows/deploy.yml):

- רץ על כל `push` ל-`main`
- מריץ `npm ci` ואז `npm run build`
- מעלה את תיקיית `dist` כ-artifact
- מפרסם ל-GitHub Pages
