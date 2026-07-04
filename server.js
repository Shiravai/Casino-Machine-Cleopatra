/* ============================================================
   Cleopatra's Gold — tiny LAN server for playing on your phone
   Run: node server.js   (or double-click Play-On-Phone.bat)
   ============================================================ */

const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = 8765;
const ROOT = __dirname;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".apk": "application/vnd.android.package-archive",
};

const APK_NAME = "CleopatrasGold.apk";

function lanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return "localhost";
}

function connectPage(gameUrl, apkUrl, apkExists) {
  const qrGame = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(gameUrl)}`;
  const qrApk = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(apkUrl)}`;
  const apkBlock = apkExists
    ? `
    <div class="col">
      <h2>אפליקציה מותקנת (APK)</h2>
      <img class="qr" src="${qrApk}" alt="QR — הורדת ה-APK">
      <div class="url">${apkUrl}</div>
      <ol>
        <li>סרקו וזה יוריד את <b>CleopatrasGold.apk</b></li>
        <li>פתחו את הקובץ שהורד ← <b>התקן</b></li>
        <li>אם וינדוס/אנדרואיד שואל על "מקור לא מוכר" — לאשר להתקנה הזו</li>
        <li>נפתח אייקון אמיתי במסך הבית — עובד גם בלי Wi-Fi!</li>
      </ol>
    </div>`
    : `
    <div class="col">
      <h2>אפליקציה מותקנת (APK)</h2>
      <p class="missing">עוד לא נבנה APK — הריצי build:android כדי ליצור אותו.</p>
    </div>`;

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cleopatra's Gold — שליחה לטלפון</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         background:radial-gradient(ellipse at 50% 30%, #241104, #0b0603 70%);
         font-family:"Segoe UI", system-ui, sans-serif; color:#fff3b8; }
  .card { text-align:center; max-width:920px; padding:36px 30px; border-radius:24px;
          background:rgba(20,10,3,.7); border:1px solid rgba(255,208,106,.5);
          box-shadow:0 0 70px rgba(255,178,48,.15); margin:20px; }
  h1 { font-family:Georgia, serif; margin:0 0 4px; letter-spacing:.04em; font-size:28px;
       background:linear-gradient(180deg,#fff7cf,#ffd96a 40%,#c47a14 65%,#ffe89a);
       -webkit-background-clip:text; background-clip:text; color:transparent; }
  .sub { color:rgba(255,236,180,.7); margin-bottom:26px; font-size:14px; }
  .cols { display:flex; flex-wrap:wrap; gap:28px; justify-content:center; }
  .col { flex:1 1 340px; max-width:400px; padding:18px; border-radius:16px; background:rgba(255,214,120,.05); }
  .col h2 { font-family:Georgia, serif; font-size:16px; color:#ffd96a; margin:0 0 14px; letter-spacing:.05em; }
  img.qr { width:min(240px, 60vw); border-radius:16px; border:6px solid #fff3b8;
           box-shadow:0 10px 40px rgba(0,0,0,.6); background:#fff; }
  .url { direction:ltr; font-family:Consolas, monospace; font-size:14px; font-weight:700;
         color:#2ce0cf; margin:14px 0 18px; user-select:all; word-break:break-all; }
  ol { text-align:right; font-size:13px; line-height:1.8; margin:0 auto; max-width:340px; padding-inline-start:20px; }
  li b { color:#ffd96a; }
  .missing { font-size:13px; color:rgba(255,236,180,.6); }
  .note { margin-top:26px; font-size:12px; color:rgba(255,236,180,.55); }
</style>
</head>
<body>
  <div class="card">
    <h1>CLEOPATRA'S GOLD 🎰</h1>
    <div class="sub">בחרו איך לשחק בטלפון</div>
    <div class="cols">
      <div class="col">
        <h2>שחקו בדפדפן (מיידי)</h2>
        <img class="qr" src="${qrGame}" alt="QR — סרקו עם הטלפון">
        <div class="url">${gameUrl}</div>
        <ol>
          <li>ודאו שהטלפון <b>מחובר לאותו Wi-Fi</b> כמו המחשב</li>
          <li>סרקו — המשחק ייפתח בכרום</li>
          <li>תפריט ⋮ ← <b>"הוספה למסך הבית"</b></li>
        </ol>
      </div>
      ${apkBlock}
    </div>
    <div class="note">משאירים את החלון השחור (השרת) פתוח בזמן שמורידים · אם וינדוס שואל — לאשר גישה לרשת פרטית</div>
  </div>
</body>
</html>`;
}

const gameUrl = `http://${lanIp()}:${PORT}/`;
const apkUrl = `http://${lanIp()}:${PORT}/${APK_NAME}`;

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0].split("#")[0]);

  if (urlPath === "/phone") {
    const apkExists = fs.existsSync(path.join(ROOT, APK_NAME));
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(connectPage(gameUrl, apkUrl, apkExists));
    return;
  }

  let filePath = path.normalize(path.join(ROOT, urlPath === "/" ? "index.html" : urlPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  });
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.log("\n  Server is already running — just open: " + gameUrl);
  } else {
    console.error(error.message);
  }
  process.exit(1);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("\n  ============================================");
  console.log("   CLEOPATRA'S GOLD — phone server is running");
  console.log("  ============================================\n");
  console.log("   On your phone (same Wi-Fi):  " + gameUrl);
  console.log("   QR + instructions:           http://localhost:" + PORT + "/phone\n");
  console.log("   Keep this window open while playing.");
  console.log("   Press Ctrl+C to stop.\n");
});
