import type { BunPlugin } from "bun";

const outputDirectory = process.argv[2] ?? "dist";

const inlinePngPlugin: BunPlugin = {
  name: "inline-cloud-pngs",
  setup(build) {
    build.onLoad({ filter: /\.png$/ }, async ({ path }) => {
      const bytes = await Bun.file(path).arrayBuffer();
      const dataUrl = `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
      return {
        contents: `export default ${JSON.stringify(dataUrl)};`,
        loader: "js",
      };
    });
  },
};

const result = await Bun.build({
  entrypoints: ["src/frontend.ts"],
  outdir: outputDirectory,
  target: "browser",
  plugins: [inlinePngPlugin],
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

const output = result.outputs.find((entry) => entry.path.endsWith("frontend.js"));
if (output) console.log(`Built ${output.path} (${(output.size / 1024).toFixed(2)} KB)`);
