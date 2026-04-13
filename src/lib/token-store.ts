import { promises as fs } from "fs";
import path from "path";

const dataDir = path.join(process.cwd(), "data");
const filePath = path.join(dataDir, "push-tokens.json");

type TokenEntry = {
  token: string;
  updatedAt: string;
};

export async function saveToken(token: string) {
  await fs.mkdir(dataDir, { recursive: true });
  const data = await readTokens();
  const existingIndex = data.findIndex((item) => item.token === token);
  const entry = { token, updatedAt: new Date().toISOString() };

  if (existingIndex >= 0) {
    data[existingIndex] = entry;
  } else {
    data.push(entry);
  }

  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  return entry;
}

export async function readTokens(): Promise<TokenEntry[]> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as TokenEntry[];
  } catch {
    return [];
  }
}
