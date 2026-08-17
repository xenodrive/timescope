import { globSync, readFileSync } from "node:fs";
import { basename } from "node:path";

const CODE = "```";

function extractMeta(lines: string[]) {
  const result = {
    title: "",
  };
  for (const line of lines) {
    if (line.startsWith("title: ")) {
      result.title = line.substring("title: ".length);
    }
  }
  return result;
}

function extractRegion(name: string, lines: string[]) {
  const blocks: string[][] = [];
  let block: string[] = [];
  let include = false;
  let omitDepth = 0;
  const flush = () => {
    if (block.length) blocks.push(block);
    block = [];
  };

  for (const line of lines) {
    if (line.includes(`#region ${name}`)) {
      include = true;
      continue;
    }
    if (line.includes(`#endregion ${name}`)) {
      flush();
      include = false;
      continue;
    }
    if (line.includes("#region docs-ignore")) {
      if (include && omitDepth === 0) flush();
      omitDepth++;
      continue;
    }
    if (line.includes("#endregion docs-ignore")) {
      omitDepth = Math.max(0, omitDepth - 1);
      continue;
    }
    if (!include || omitDepth > 0) continue;
    block.push(line + "\n");
  }
  flush();

  return blocks
    .map((lines) => {
      const indentation = lines
        .filter((line) => line.trim())
        .reduce(
          (minimum, line) =>
            Math.min(minimum, line.match(/^\s*/)?.[0].length ?? 0),
          Infinity,
        );
      if (!Number.isFinite(indentation) || indentation === 0)
        return lines.join("");
      return lines
        .map((line) => line.slice(Math.min(indentation, line.length)))
        .join("");
    })
    .join("")
    .replace(/\n\n\n+/g, "\n\n");
}

function parseCode(code: string) {
  const lines = code.split("\n");

  const html = extractRegion("html", lines);
  const js = extractRegion("code", lines);
  const style = extractRegion("style", lines);
  const meta = extractMeta(lines);

  return { js, html, style, meta };
}

export default {
  watch: ["./*.vue", "./*.md"],
  paths() {
    return globSync(import.meta.dirname + "/*.vue").map((filename) => {
      const name = basename(filename, ".vue");

      const { js, html, style, meta } = parseCode(
        readFileSync(filename, "utf-8"),
      );
      let content: string | undefined = undefined;
      try {
        content = readFileSync(filename.replace(".vue", ".md"), "utf-8");
      } catch {
        // do nothing
      }

      return {
        params: {
          name,
        },
        content:
          content ??
          `
<script setup>
import Example from '@/guide/examples/${name}.vue';
</script>

# ${meta?.title ?? name}

## Example
<Example />

## Code
${CODE}HTML
${html}
${CODE}
${CODE}TypeScript
${js}
${CODE}
${
  style
    ? `
${CODE}CSS
${style}
${CODE}`
    : ``
}
        `.trim(),
      };
    });
  },
};
