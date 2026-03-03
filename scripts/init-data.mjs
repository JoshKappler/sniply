import { existsSync, mkdirSync, copyFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const seedDir = join(root, "data-seed");
const dataDir = join(root, "data");

mkdirSync(dataDir, { recursive: true });

for (const file of readdirSync(seedDir)) {
  const dest = join(dataDir, file);
  if (!existsSync(dest)) {
    copyFileSync(join(seedDir, file), dest);
    console.log(`Initialized ${file} from seed`);
  }
}
console.log("Data directory ready.");
