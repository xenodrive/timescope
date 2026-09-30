import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { afterAll, beforeAll, test } from "vitest";

const execFileAsync = promisify(execFile);
const root = path.resolve(import.meta.dirname, "..");
let temporaryDirectory: string;
let distribution: URL;

beforeAll(async () => {
  temporaryDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "timescope-dist-globals-"),
  );
  const directory = path.join(temporaryDirectory, "timescope");
  await fs.cp(path.join(root, "dist/timescope"), directory, { recursive: true });
  // The distribution's peer dependencies are installed in the source package.
  await fs.symlink(
    path.join(root, "packages/timescope/node_modules"),
    path.join(directory, "node_modules"),
    "dir",
  );
  distribution = pathToFileURL(`${directory}/`);
});

afterAll(async () => {
  if (temporaryDirectory) {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
});

async function checkEntry(entry: string, source: string) {
  const script = path.join(temporaryDirectory, `${entry}.check.mjs`);
  await fs.writeFile(script, source);
  await execFileAsync(process.execPath, [
    script,
    new URL(entry, distribution).href,
  ]);
}

test("browser.js exposes all runtime exports on globalThis", async () => {
  await checkEntry(
    "browser.js",
    `
      import assert from "node:assert/strict";
      import { readFile } from "node:fs/promises";
      import { createContext, runInContext } from "node:vm";

      const exports = await import(new URL("index.js", process.argv[2]));
      assert.equal(typeof exports.Timescope, "function");

      const context = createContext({});
      const source = await readFile(new URL(process.argv[2]), "utf8");
      runInContext(source, context);

      for (const [name, value] of Object.entries(exports)) {
        assert.ok(Object.hasOwn(context, name), name + " is missing from globalThis");
        assert.notEqual(context[name], undefined, name + " is undefined");
        assert.equal(typeof context[name], typeof value, name + " has an unexpected type");
      }
    `,
  );
});

test.each(["index.js", "index.node.js"])(
  "%s does not modify globalThis",
  async (entry) => {
    await checkEntry(
      entry,
      `
        import assert from "node:assert/strict";

        // Materialize Node.js's lazy globals before taking the baseline.
        Object.getOwnPropertyDescriptors(globalThis);
        const before = Object.getOwnPropertyDescriptors(globalThis);
        const exports = await import(process.argv[2]);
        const after = Object.getOwnPropertyDescriptors(globalThis);

        assert.equal(typeof exports.Timescope, "function");
        assert.deepEqual(Reflect.ownKeys(after), Reflect.ownKeys(before));
        for (const key of Reflect.ownKeys(before)) {
          assert.deepEqual(after[key], before[key], String(key) + " must not change");
        }
      `,
    );
  },
);
