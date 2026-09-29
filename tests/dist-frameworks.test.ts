import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, test } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
let temporaryDirectory: string;
let tarballs: Record<"core" | "svelte" | "vue", string>;

function run(command: string, args: string[], cwd: string) {
  return new Promise<void>((resolve, reject) => {
    const process = spawn(command, args, { cwd, stdio: "inherit" });
    process.on("error", reject);
    process.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} ${args.join(" ")} exited with ${code}`)),
    );
  });
}

async function checkConsumer(framework: "svelte" | "vue") {
  const directory = path.join(temporaryDirectory, `${framework}-consumer`);
  await fs.cp(
    path.join(root, `tests/fixtures/${framework}-consumer`),
    directory,
    { recursive: true },
  );

  const packageJsonPath = path.join(directory, "package.json");
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
  packageJson.dependencies[`@timescope/${framework}`] =
    `file:${tarballs[framework]}`;
  await fs.writeFile(
    packageJsonPath,
    `${JSON.stringify(packageJson, null, 2)}\n`,
  );
  await fs.writeFile(
    path.join(directory, "pnpm-workspace.yaml"),
    `overrides:\n  timescope: ${JSON.stringify(`file:${tarballs.core}`)}\n`,
  );

  await run("pnpm", ["install"], directory);
  await run("pnpm", ["run", "check"], directory);
}

beforeAll(async () => {
  temporaryDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "timescope-dist-check-"),
  );
  tarballs = {
    core: path.join(temporaryDirectory, "timescope.tgz"),
    svelte: path.join(temporaryDirectory, "timescope-svelte.tgz"),
    vue: path.join(temporaryDirectory, "timescope-vue.tgz"),
  };

  await Promise.all([
    run(
      "pnpm",
      ["pack", "--out", tarballs.core],
      path.join(root, "dist/timescope"),
    ),
    run(
      "pnpm",
      ["pack", "--out", tarballs.svelte],
      path.join(root, "dist/@timescope--svelte"),
    ),
    run(
      "pnpm",
      ["pack", "--out", tarballs.vue],
      path.join(root, "dist/@timescope--vue"),
    ),
  ]);
});

afterAll(async () => {
  await fs.rm(temporaryDirectory, { recursive: true, force: true });
});

test.concurrent(
  "Vue distribution supports type checking and bundling",
  () => checkConsumer("vue"),
  120_000,
);
test.concurrent(
  "Svelte distribution supports type checking and bundling",
  () => checkConsumer("svelte"),
  120_000,
);
