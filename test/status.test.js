import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildJsonStatus, buildStatusLine } from "../src/status.js";

describe("buildStatusLine", () => {
  it("renders a fallback line when no token is provided", () => {
    const line = buildStatusLine({ noToken: true, error: "No API token provided" }, { plain: true });
    assert.ok(line.includes("Claude"), "line should include model name");
  });

  it("renders a full status line from API data", () => {
    const line = buildStatusLine({
      ok: true,
      data: {
        email: "user@example.com",
        autoSwitch: { enabled: true, triggered: false },
        sessionUsage: { used: 60, limit: 100, percent: 60 },
        weeklyUsage: { used: 350, limit: 500, percent: 70 },
        resets: { session: new Date(Date.now() + 7200_000).toISOString(), weekly: new Date(Date.now() + 259_200_000).toISOString() },
      },
    }, { plain: true });

    assert.ok(line.includes("Claude"), "model");
    assert.ok(line.includes("user@example.com"), "email");
    assert.ok(line.includes("Auto Switch ON"), "auto switch");
    assert.ok(line.includes("Sess"), "session usage");
    assert.ok(line.includes("Week"), "weekly usage");
    assert.ok(line.includes("reset:"), "reset timers");
  });

  it("renders from the new connectedAccount + usage response shape", () => {
    const line = buildStatusLine({
      ok: true,
      data: {
        device: {
          id: "vV4v2VjN5C9ge2Mf1gnv",
          nickname: "Home PC",
          connectedAccountId: "YBT9CHb2yPCgFhXzuuJi",
        },
        connectedAccount: {
          id: "YBT9CHb2yPCgFhXzuuJi",
          email: "nityabalar1+o3@gmail.com",
          sessionUsage: "9.7%",
          sessionResetIn: "2 hours.",
          weeklySessionUsage: "16.4%",
          weeklySessionResetIn: "1 day.",
        },
        usage: {
          session: { usage: "9.7%", reset: "2 hours." },
          weekly: { usage: "16.4%", reset: "1 day." },
        },
        autoSwitch: { enabled: true, triggered: false, reason: null },
      },
    }, { plain: true });

    assert.ok(line.includes("Claude"), "model");
    assert.ok(line.includes("nityabalar1+o3@gmail.com"), "email");
    assert.ok(line.includes("Sess"), "session usage");
    assert.ok(line.includes("Week"), "weekly usage");
    assert.ok(line.includes("reset:"), "reset timers");
    assert.ok(line.includes("Auto Switch ON"), "auto switch");
  });

  it("prefixes with Switched when autoSwitch.triggered is true", () => {
    const line = buildStatusLine({
      ok: true,
      data: {
        autoSwitch: { enabled: true, triggered: true },
      },
    }, { plain: true });

    assert.ok(line.includes("Switched"), "should indicate a switch");
  });
});

describe("buildJsonStatus", () => {
  it("returns normalized JSON shape", () => {
    const json = buildJsonStatus({ ok: true, data: { email: "a@b.com" } });
    assert.equal(json.model, "Claude");
    assert.equal(json.email, "a@b.com");
    assert.equal(json.ok, true);
  });
});
