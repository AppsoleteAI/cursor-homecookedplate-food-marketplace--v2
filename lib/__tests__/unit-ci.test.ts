import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "../..");

function source(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

describe("unit tests in CI", () => {
  it("runs the existing suite with coverage and does not deploy", () => {
    const workflow = source(".github/workflows/unit-tests.yml");
    const pkg = JSON.parse(source("package.json")) as { scripts: { test: string } };
    const jestConfig = source("jest.config.js");
    const store = source(".github/workflows/store-release.yml");
    const pages = source(".github/workflows/deploy-pages.yml");

    expect(pkg.scripts.test).toBe("jest --watchman=false --forceExit");
    expect(workflow).toContain("npm test -- --coverage");
    expect(workflow).not.toContain("wrangler");
    expect(workflow).not.toContain("eas-cli");
    expect(workflow).not.toContain("pages deploy");
    expect(jestConfig).toContain("backend/**/*.{ts,tsx}");
    expect(jestConfig).toContain("lib/**/*.{ts,tsx}");
    expect(jestConfig).not.toContain("coverageThreshold");
    expect(store).toContain("if: false");
    expect(pages).toContain("if: false");
  });
});
