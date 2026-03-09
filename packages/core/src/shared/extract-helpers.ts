import fs from 'fs';
import path from 'path';
import {
  parsePngTextChunks,
  buildFolderMap as buildRisuFolderMap,
  resolveFolderName as resolveRisuFolderName,
  type RisuCharbookEntry,
} from './risu-api';

export function sanitizeFilename(
  name: string | null | undefined,
  fallback = "unnamed",
): string {
  if (!name || typeof name !== "string") return fallback;
  const cleaned = [...name]
    .map((ch) =>
      /[<>:"/\\|?*]/.test(ch) || ch.charCodeAt(0) < 32 ? "_" : ch,
    )
    .join("")
    .replace(/\.\./g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._]+|[._]+$/g, "")
    .substring(0, 100);
  return cleaned || fallback;
}

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function writeJson(filePath: string, data: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export function writeText(filePath: string, content: string): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf-8");
}

export function writeBinary(
  filePath: string,
  data: Buffer | Uint8Array,
): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, data);
}

export function uniquePath(
  dir: string,
  baseName: string,
  ext: string,
): string {
  let candidate = path.join(dir, `${baseName}${ext}`);
  let counter = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${baseName}_${counter}${ext}`);
    counter++;
  }
  return candidate;
}

/** Wrapper around parsePngTextChunks from risu-api. */
export function parsePngChunks(buf: Buffer): Record<string, string> {
  return parsePngTextChunks(buf);
}

/** Wrapper that applies sanitizeFilename transform to folder names. */
export function buildFolderMap(
  entries: RisuCharbookEntry[],
): Record<string, string> {
  return buildRisuFolderMap(entries, {
    nameTransform: sanitizeFilename,
    fallbackName: "unnamed_folder",
  });
}

/** Wrapper that uses sanitizeFilename as the fallback transform. */
export function resolveFolderName(
  folderRef: string | null | undefined,
  folderMap: Record<string, string>,
): string | null {
  return resolveRisuFolderName(folderRef, folderMap, sanitizeFilename);
}
