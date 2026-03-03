import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");

function filePath(filename: string): string {
  return path.join(DATA_DIR, filename);
}

export function readJson<T>(filename: string, defaultValue: T): T {
  try {
    const raw = fs.readFileSync(filePath(filename), "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

export function writeJson(filename: string, data: unknown): void {
  const fp = filePath(filename);
  const tmp = fp + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmp, fp);
}
