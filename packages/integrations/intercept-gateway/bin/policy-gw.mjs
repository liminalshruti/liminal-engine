#!/usr/bin/env node
import { runPolicyGwCli } from "../src/cli.ts";

process.exitCode = await runPolicyGwCli(process.argv.slice(2), {
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr,
  fetch,
});
