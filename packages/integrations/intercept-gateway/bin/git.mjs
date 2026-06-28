#!/usr/bin/env node
import { runShim } from "../src/shim-runner.ts";

process.exitCode = await runShim("git", process.argv.slice(2));
