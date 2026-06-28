#!/usr/bin/env node
import { runShim } from "../src/shim-runner.ts";

process.exitCode = await runShim("gh", process.argv.slice(2));
