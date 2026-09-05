#!/usr/bin/env node
/**
 * Runs a command inside the API virtualenv from anywhere in the monorepo.
 *
 * Exists so the root package.json scripts work the same on Windows, macOS and
 * Linux, where the venv puts its interpreter in different places.
 *
 *   node scripts/api.mjs uvicorn crm.main:app --reload
 *   node scripts/api.mjs alembic upgrade head
 *   node scripts/api.mjs pytest
 *   node scripts/api.mjs scripts/seed_data.py
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = join(root, "apps", "api");

const candidates = [
  join(apiDir, ".venv", "Scripts", "python.exe"), // Windows
  join(apiDir, ".venv", "bin", "python"), // macOS / Linux
];
const python = candidates.find(existsSync);

if (!python) {
  console.error(
    [
      "No virtualenv found at apps/api/.venv",
      "",
      "Create it first:",
      "  cd apps/api",
      "  python -m venv .venv",
      process.platform === "win32"
        ? "  .venv/Scripts/python -m pip install -e \".[dev]\""
        : "  .venv/bin/python -m pip install -e '.[dev]'",
    ].join("\n"),
  );
  process.exit(1);
}

const [tool, ...rest] = process.argv.slice(2);
if (!tool) {
  console.error(
    "Usage: node scripts/api.mjs <uvicorn|alembic|pytest|ruff|mypy|path/to/script.py> [args...]",
  );
  process.exit(1);
}

// A `.py` path is run as a script; anything else is a module name, invoked with
// `-m` so the venv's own entry points are used rather than whatever is on PATH.
const argv = tool.endsWith(".py") ? [tool, ...rest] : ["-m", tool, ...rest];

const child = spawn(python, argv, {
  cwd: apiDir,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
