import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
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
copyFileSync(join(root, "assets", "images", "favicon.png"), join(dist, "favicon.png"));

const faviconLink = '<link rel="icon" type="image/png" href="/favicon.png" />';
const html = readFileSync(indexHtml, "utf8");
const withFavicon = html.includes('href="/favicon.png"')
  ? html
  : html.replace("</head>", `  ${faviconLink}\n  </head>`);
writeFileSync(indexHtml, withFavicon);

const legalDir = join(dist, "legal");
mkdirSync(legalDir, { recursive: true });
copyFileSync(join(root, "assets", "house-mark.png"), join(legalDir, "house-mark.png"));
copyFileSync(join(root, "pages", "legal", "privacy-preview.png"), join(legalDir, "privacy-preview.png"));
for (const name of ["privacy", "terms", "support"]) {
  const file = join(root, "pages", "legal", `${name}.html`);
  copyFileSync(file, join(legalDir, `${name}.html`));
  const dir = join(dist, name);
  mkdirSync(dir, { recursive: true });
  copyFileSync(file, join(dir, "index.html"));
}

const membershipPage = join(root, "pages", "legal", "membership.html");
copyFileSync(membershipPage, join(legalDir, "membership.html"));
const informationDir = join(dist, "information");
mkdirSync(informationDir, { recursive: true });
copyFileSync(membershipPage, join(informationDir, "index.html"));

const membershipImages = [
  "header-homemade-food.jpg",
  "search-order-homemade-food.jpg",
  "screenshot-sign-in.jpg",
  "screenshot-meal-list.jpg",
  "screenshot-one-meal.jpg",
  "screenshot-checkout.jpg",
  "screenshot-membership.jpg",
  "screenshot-membership-platetaker.jpg",
  "dynamic-tablets.png",
  "dynamic-template.png",
  "dynamic-windows.png",
];
for (const name of membershipImages) {
  copyFileSync(join(root, "store-assets", name), join(informationDir, name));
}
