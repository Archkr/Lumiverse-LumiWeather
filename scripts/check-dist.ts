import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const targets = [
  { source: "src/backend.ts", output: "dist/backend.js", target: "bun" },
  { source: "src/frontend.ts", output: "dist/frontend.js", target: "browser" },
] as const;

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

const temporaryDirectory = await mkdtemp(join(tmpdir(), "story-weather-dist-"));
let hasDrift = false;

try {
  for (const target of targets) {
    const generatedPath = join(temporaryDirectory, target.output.replaceAll("/", "_"));
    const child = Bun.spawn(
      ["bun", "build", target.source, "--outfile", generatedPath, "--target", target.target],
      { stdout: "inherit", stderr: "inherit" },
    );
    if ((await child.exited) !== 0) throw new Error(`Bundle build failed: ${target.source}`);

    const [generated, committed] = await Promise.all([
      readFile(generatedPath),
      readFile(target.output).catch(() => null),
    ]);

    if (!committed || !sameBytes(generated, committed)) {
      console.error(`Generated bundle drift detected: ${target.output}`);
      hasDrift = true;
    }
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

if (hasDrift) throw new Error("Generated bundle drift detected.");
