import { isBuiltin } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (err.code === "ERR_MODULE_NOT_FOUND" && !isBuiltin(specifier)) {
      if (context.parentURL) {
        const parentDir = path.dirname(fileURLToPath(context.parentURL));
        const candidateBase = path.resolve(parentDir, specifier);
        for (const ext of [".ts", ".tsx", ".js", ".mjs"]) {
          if (existsSync(candidateBase + ext)) {
            return nextResolve(pathToFileURL(candidateBase + ext).href, context);
          }
        }
      }
    }
    throw err;
  }
}
