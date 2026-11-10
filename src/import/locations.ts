import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface SourceLocation {
  directory: string;
  manifestPath: string;
}

export function originalSourceLocation(): SourceLocation {
  return {
    directory: process.env.SOURCE_DATA_DIR
      ? resolve(process.env.SOURCE_DATA_DIR)
      : fileURLToPath(new URL("../../data/source/", import.meta.url)),
    manifestPath: fileURLToPath(new URL("../../data/source-manifest.json", import.meta.url)),
  };
}

export const demoSourceLocation: SourceLocation = {
  directory: fileURLToPath(new URL("../../data/demo/", import.meta.url)),
  manifestPath: fileURLToPath(new URL("../../data/demo/source-manifest.json", import.meta.url)),
};
