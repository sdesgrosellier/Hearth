// Adds a warm boot message and an on-screen diagnostic box to Expo's generated web
// shell so a failed load can be reported instead of showing a blank page.
import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2];
let html = readFileSync(file, "utf8");
const boot = `<div id="boot" style="position:fixed;inset:0;display:flex;flex-direction:column;gap:10px;align-items:center;justify-content:center;font:15px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;opacity:.8;background:#F5F8F9;color:#223642"><div style="font-size:40px">◎</div><div>Gathering your advisors…</div></div>
    <div id="diag" role="alert" style="position:fixed;left:12px;right:12px;bottom:12px;max-height:40%;overflow:auto;background:#fff7f5;color:#7a2e26;border:1px solid #e4b4ad;border-radius:12px;padding:10px 12px;font:12px/1.45 ui-monospace,Menlo,monospace;display:none;white-space:pre-wrap;word-break:break-word;z-index:9999"></div>
    <script>
      (function () {
        var diag = document.getElementById("diag"), lines = [];
        function show(msg) { lines.push(msg); diag.textContent = "Round Table couldn't start. Please tell Claude this:\\n" + lines.join("\\n"); diag.style.display = "block"; }
        window.addEventListener("error", function (e) { show("error: " + (e.message || String(e.error || e)) + (e.filename ? " (" + e.filename.split("/").pop() + ":" + e.lineno + ")" : "")); });
        window.addEventListener("unhandledrejection", function (e) { var r = e.reason; show("rejection: " + (r && (r.message || r.toString()))); });
        var tries = 0, timer = setInterval(function () {
          var root = document.getElementById("root");
          if (root && root.childElementCount > 0) { var b = document.getElementById("boot"); if (b) b.remove(); clearInterval(timer); return; }
          if (++tries === 100) show("The app did not render within 10 seconds at " + location.href);
        }, 100);
      })();
    </script>
    <div id="root"></div>`;
html = html.replace('<div id="root"></div>', boot);
html = html.replace('<meta httpEquiv="X-UA-Compatible" content="IE=edge" />\n', "");
html = html.replace("<title>Round Table</title>", '<title>Round Table</title>\n    <meta name="robots" content="noindex" />\n    <meta name="color-scheme" content="light dark" />');
writeFileSync(file, html);
console.log("decorated", file);
