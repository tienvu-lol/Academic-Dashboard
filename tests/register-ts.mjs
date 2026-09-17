// Node 24 strips TypeScript; resolve local source aliases for model tests.
import {registerHooks} from "node:module";
import {existsSync} from "node:fs";
import {fileURLToPath} from "node:url";
const sourceRoot = new URL("../src/", import.meta.url);
registerHooks({resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) specifier = new URL(specifier.slice(2), sourceRoot).href;
  if (specifier.startsWith(".") || specifier.startsWith("file:")) {
    const url = new URL(specifier, context.parentURL);
    if (!/\.[a-z]+$/i.test(url.pathname)) {
      for (const extension of [".ts", ".tsx"]) {
        const candidate = `${url.href}${extension}`;
        if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate, context);
      }
    }
  }
  return nextResolve(specifier, context);
}});
