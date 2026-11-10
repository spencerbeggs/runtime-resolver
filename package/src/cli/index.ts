#!/usr/bin/env node

// The workspace root links this package through `workspace:*`, so its
// `.bin/runtime-resolver` runs this file from source, where no pnpm
// `nodeOptions` load tsx. Register it here, before anything resolves a `.js`
// import from source. The built `.js` bin never takes this branch, and the
// specifier is computed so the bundler does not inline tsx into the package.
if (import.meta.url.endsWith(".ts")) {
	const tsx = ["tsx", "esm", "api"].join("/");
	const { register } = (await import(tsx)) as { readonly register: () => void };
	register();
}

const { main } = await import("./main.js");
await main(process.argv.slice(2));
