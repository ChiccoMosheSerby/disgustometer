# מד הגועל · Disgustometer

אפליקציית רשת שמקבלת רשימת "מרכיבים" בקול או בהקלדה, שולחת אותה ל-Claude,
ומחזירה ציון גועל מ-0 עד 100 על מחוג מונפש.

A voice-driven "disgust meter": say (or type) any combination of things, and
Claude rates how disgusting it is from 0–100 on an animated gauge.

---

## למה צריך שרת? · Why a server?

ה-**API key של Anthropic לעולם לא יושב בקוד הצד-לקוח** (React), אחרת כל מי
שנכנס לאתר יכול לגנוב אותו. לכן יש שרת Express קטן שמחזיק את המפתח בקובץ `.env`
ומעביר את הבקשות ל-Anthropic. ה-React מדבר רק עם השרת שלך.

The Anthropic key must never live in the browser. A tiny Express server holds it
and proxies requests; React only ever talks to your own server.

**MongoDB?** לא נחוץ כרגע — האפליקציה לא שומרת כלום. אם בעתיד תרצו לשמור היסטוריית
דירוגים / לוח שיא, זה המקום להוסיף את ה-`M` של MERN: התקינו `mongoose` בשרת ושמרו
כל תוצאה בנקודת הקצה `/api/rate`.

---

## הרצה · Run it

צריך Node.js 18+ (מומלץ 20+).

```bash
# 1. התקנת כל החבילות (root + server + client)
npm run install:all

# 2. הגדרת המפתח
cd server
cp .env.example .env
#   ערכו את .env והדביקו את ה-API key שלכם

# 3. חזרה לשורש והרצה של שני השרתים יחד
cd ..
npm run dev
```

- הלקוח (React) ירוץ על http://localhost:5173
- ה-API (Express) ירוץ על http://localhost:3001
- בקשות מ-`/api/*` מנותבות אוטומטית לשרת (דרך proxy ב-Vite), כך שאין בעיות CORS.

פתחו את הדפדפן ב-http://localhost:5173 ולחצו על המיקרופון —
**הפעם הקול יעבוד**, כי זה דף רגיל ולא תוך-צ'אט (דורש Chrome/Edge ואישור גישה למיקרופון).

### הרצה ידנית בשני טרמינלים (חלופה)
```bash
# טרמינל 1
cd server && npm run dev
# טרמינל 2
cd client && npm run dev
```

---

## מבנה · Structure

```
disgustometer/
├── package.json          # סקריפט dev שמריץ את שניהם יחד
├── server/
│   ├── index.js          # Express + נקודת הקצה /api/rate
│   ├── .env.example      # כאן שמים את ה-API key
│   └── package.json
└── client/               # אפליקציית Vite + React
    ├── index.html
    ├── vite.config.js    # proxy של /api → :3001
    └── src/
        ├── main.jsx
        ├── App.jsx       # כל ה-UI: המחוג, הקול, הקריאה לשרת
        └── styles.css
```

---

## בנייה ל-production · Build

```bash
npm run build          # בונה את client/dist
```
אפשר להגיש את `client/dist` כקבצים סטטיים מהשרת, או לפרוס בנפרד.
המודל נקבע דרך `CLAUDE_MODEL` ב-`server/.env`.
