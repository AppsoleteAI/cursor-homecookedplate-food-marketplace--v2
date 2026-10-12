import { copyFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const indexHtml = join(dist, "index.html");

if (!statSync(indexHtml, { throwIfNoEntry: false })?.isFile()) {
  throw new Error("dist/index.html is missing. Run expo export --platform web first.");
}

const fontsDir = join(dist, "fonts");
mkdirSync(fontsDir, { recursive: true });

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walk(path);
      continue;
    }
    if (name.endsWith(".ttf")) {
      copyFileSync(path, join(fontsDir, name));
    }
  }
}

walk(dist);
copyFileSync(join(root, "pages", "_worker.js"), join(dist, "_worker.js"));

const legalDir = join(dist, "legal");
mkdirSync(legalDir, { recursive: true });
copyFileSync(join(root, "assets", "house-mark.png"), join(legalDir, "house-mark.png"));
for (const name of ["privacy", "terms", "support"]) {
  const file = join(root, "pages", "legal", `${name}.html`);
  copyFileSync(file, join(legalDir, `${name}.html`));
  const dir = join(dist, name);
  mkdirSync(dir, { recursive: true });
  copyFileSync(file, join(dir, "index.html"));
}
