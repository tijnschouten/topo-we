import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const root = new URL("../", import.meta.url);
let prepared = false;
try {
  const manifest = JSON.parse(
    readFileSync(new URL("public/geo/manifest.json", root), "utf8"),
  );
  prepared =
    manifest.schema === 9 &&
    existsSync(new URL("public/geo/index.json.gz", root)) &&
    manifest.files.length > 15000 &&
    manifest.files.every((f) =>
      existsSync(new URL(`public/geo/${f.id}.json.gz`, root)) &&
        (!f.detailFile || existsSync(new URL(`public/geo/${f.detailFile}`, root))),
    );
} catch {
  /* The Python converter will fetch and validate the pinned sources. */
}
if (!prepared) {
  const result = spawnSync("python3", ["scripts/prepare_geo.py"], {
    cwd: root,
    stdio: "inherit",
  });
  if (result.error)
    console.error(
      "Install Python and scripts/geo-requirements.txt, then run npm run prepare:geo.",
    );
  process.exit(result.status ?? 1);
}
console.log("Verified prepared source geometry.");
