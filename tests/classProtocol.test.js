import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_MESSAGES, parseClientMessage } from "../shared/protocol/messages.js";

test("selectClass protocol accepts sanitized class ids", () => {
  const parsed = parseClientMessage(JSON.stringify({
    type: CLIENT_MESSAGES.SELECT_CLASS,
    classId: "twin"
  }));

  assert.equal(parsed.ok, true);
  assert.equal(parsed.message.classId, "twin");
});

test("selectClass protocol rejects empty class ids", () => {
  const parsed = parseClientMessage(JSON.stringify({
    type: CLIENT_MESSAGES.SELECT_CLASS,
    classId: "$$$"
  }));

  assert.equal(parsed.ok, false);
});
