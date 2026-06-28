import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyCommand, toInterceptedAction } from "./shim-classifier.ts";

test("classifyCommand intercepts gh pr merge", () => {
  assert.deepEqual(classifyCommand("gh", ["pr", "merge", "20", "--merge"]), {
    tool: "gh",
    action: "pr-merge",
    target: "PR#20",
    args: { argv: ["pr", "merge", "20", "--merge"] },
  });
});

test("classifyCommand intercepts gh repo fork", () => {
  assert.deepEqual(classifyCommand("gh", ["repo", "fork", "owner/repo"]), {
    tool: "gh",
    action: "repo-fork",
    target: "owner/repo",
    args: { argv: ["repo", "fork", "owner/repo"] },
  });
});

test("classifyCommand intercepts gh repo visibility changes", () => {
  assert.deepEqual(classifyCommand("gh", ["repo", "edit", "--visibility", "private"]), {
    tool: "gh",
    action: "repo-edit-visibility",
    args: {
      argv: ["repo", "edit", "--visibility", "private"],
      repo: { visibility: "private" },
    },
  });
});

test("classifyCommand intercepts git push --force and ignores harmless push", () => {
  assert.deepEqual(classifyCommand("git", ["push", "origin", "main", "--force"]), {
    tool: "git",
    action: "push",
    target: "origin main",
    args: {
      argv: ["push", "origin", "main", "--force"],
      force: true,
      forceWithLease: false,
    },
  });
  assert.equal(classifyCommand("git", ["push", "origin", "main"]), null);
});

test("classifyCommand intercepts deploy commands", () => {
  assert.deepEqual(classifyCommand("deploy", ["release", "--env", "prod"]), {
    tool: "deploy",
    action: "deploy",
    target: "prod",
    args: {
      argv: ["release", "--env", "prod"],
      deploy: { environment: "prod" },
    },
  });
});

test("toInterceptedAction stamps provenance without inventing missing fields", () => {
  const command = classifyCommand("git", ["push", "--force-with-lease"])!;
  assert.deepEqual(
    toInterceptedAction("ia_force", "2026-06-27T20:00:00.000Z", command, { goalId: "goal" }),
    {
      id: "ia_force",
      tool: "git",
      action: "push",
      args: {
        argv: ["push", "--force-with-lease"],
        force: true,
        forceWithLease: true,
      },
      goalId: "goal",
      requestedAt: "2026-06-27T20:00:00.000Z",
    },
  );
});
