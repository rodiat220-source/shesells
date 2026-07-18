import assert from "node:assert/strict";

const backendBaseUrl = (process.env.BACKEND_API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");
const testMessage = process.argv.slice(2).join(" ").trim();

async function request(path, init) {
  const response = await fetch(`${backendBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`${path} returned non-JSON response: ${text.slice(0, 200)}`);
  }

  assert.equal(response.ok, true, `${path} HTTP ${response.status}: ${text}`);
  assert.equal(body.code, 0, `${path} business error: ${body.message ?? text}`);
  assert.ok(body.data, `${path} missing data`);
  return body.data;
}

console.log(`Backend smoke test: ${backendBaseUrl}`);

const session = await request("/api/session", {
  method: "POST",
  body: JSON.stringify({ scenario_id: "sensitive_early_c_late_a" }),
});

assert.equal(typeof session.session_id, "string");
assert.ok(session.session_id.length > 0);
assert.equal(session.customer_profile?.name, "林小姐");
assert.equal(session.customer_profile?.skin_type, "敏感肌");
assert.equal(typeof session.initial_customer_message, "string");
assert.ok(session.initial_customer_message.length > 0);

console.log("OK create session");
console.log(`session_id: ${session.session_id}`);
console.log(`customer: ${session.customer_profile.name} / ${session.customer_profile.skin_type}`);
console.log(`initial: ${session.initial_customer_message}`);

const detail = await request(`/api/session/${encodeURIComponent(session.session_id)}`);
assert.equal(detail.session_id, session.session_id);
assert.equal(Array.isArray(detail.messages), true);
assert.equal(detail.messages[0]?.role, "customer");

console.log("OK get session");
console.log(`messages: ${detail.messages.length}`);

if (testMessage) {
  const chat = await request("/api/chat", {
    method: "POST",
    body: JSON.stringify({
      session_id: session.session_id,
      message: testMessage,
    }),
  });

  assert.equal(Array.isArray(chat.messages), true);
  assert.equal(typeof chat.status, "string");
  assert.ok(chat.dimensions);

  console.log("OK chat");
  console.log(`input: ${testMessage}`);
  console.log(`status: ${chat.status}`);
  for (const message of chat.messages) {
    console.log(`${message.role}${message.type ? `/${message.type}` : ""}: ${message.content}`);
  }
} else {
  console.log("Skipped chat test. Pass a message after the command to test /api/chat.");
}
