---
name: openclaw-email-manager
description: Provision and operate OpenClaw email sending and mailbox access through the ClawMail control plane and agent gateway APIs.
homepage: http://localhost:3000
metadata: {"moltbot":{"emoji":"📬","requires":{"env":["CLAWMAIL_BASE_URL","CLAWMAIL_AGENT_TOKEN"],"bins":["curl","jq"]},"primaryEnv":"CLAWMAIL_AGENT_TOKEN"}}
---

# OpenClaw Email Manager (Provisioning + Gateway)

## Environment

Required:
- `CLAWMAIL_BASE_URL` (for example: `http://localhost:3000`)
- `CLAWMAIL_AGENT_TOKEN` (instance gateway token from `instances.rotateToken`)

Optional:
- `CLAWMAIL_OPERATOR_COOKIE` (session cookie for operator-side tRPC automation)
- `CLAWMAIL_WEBHOOK_SHARED_SECRET` (if webhook secret validation is enabled)

## Access Model

Two access planes are enforced:
- Operator plane (`/trpc/*`): session-authenticated users with tenant role checks (`viewer`, `operator`, `admin`, `owner`) manage providers, instances, policies, and token rotation.
- Agent plane (`/agent/*`): agents authenticate with scoped instance tokens via `Authorization: Bearer <token>` or `x-instance-token`.

Token behavior:
- Tokens are opaque and only token hashes are stored.
- Rotation revokes the previously active token for the instance.
- Scopes control behavior: `send`, `read_inbox`, or `*`.

## Provisioning Workflow (Operator)

Complete this once per tenant/instance:
1. Connect MailChannels at tenant scope (`tenants.connectMailchannels`).
2. Connect AgentMail at tenant scope (`tenants.connectAgentmail`).
3. Create an instance in `gateway` mode (`instances.create`).
4. Provision MailChannels sub-account for the instance (`mailchannels.provisionSubaccount`).
5. Ensure AgentMail pod/domain as needed (`agentmail.ensurePod`, `agentmail.createDomain`).
6. Provision mailbox for the instance (`agentmail.createInbox`).
7. Rotate and capture a gateway token (`instances.rotateToken`) with required scopes.

UI mapping:
- Tenant/provider setup: `Tenants` page
- Pod/domain setup: `Domains` page
- Instance, sub-account, inbox, token rotation: `Instances` page

## Agent API Quick Reference

Base URL: `${CLAWMAIL_BASE_URL}`
- `POST /agent/send`
- `GET /agent/events?limit=<1..200>`
- `GET /agent/inbox/threads`
- `GET /agent/inbox/messages/:id`
- `POST /agent/inbox/reply`

Authentication header:
- `Authorization: Bearer ${CLAWMAIL_AGENT_TOKEN}`

## Sending Email (`POST /agent/send`)

Required JSON fields:
- `from` (email)
- `to` (non-empty email array)
- `subject`
- `textBody`

Optional:
- `htmlBody`
- `headers` (`Record<string, string>`)

Policy checks are enforced before send:
- Instance must be `active`.
- Recipient count must be within `maxRecipientsPerMessage`.
- Required headers must be present (default policy requires `X-AI-Bot` and `List-Unsubscribe`).
- Allow-list / deny-list recipient-domain checks.
- Per-minute and daily caps.

Send uses MailChannels credentials provisioned for the instance and records an audit/send trail.

Example:
```bash
curl -sS -X POST "${CLAWMAIL_BASE_URL}/agent/send" \
  -H "Authorization: Bearer ${CLAWMAIL_AGENT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "from":"agent@example.com",
    "to":["user@example.net"],
    "subject":"Hello",
    "textBody":"Test message",
    "headers":{
      "X-AI-Bot":"openclaw",
      "List-Unsubscribe":"<mailto:unsubscribe@example.com>"
    }
  }'
```

## Mailbox Access (Threads, Message, Reply)

Mailbox operations require `read_inbox` scope and an instance inbox mapping.

- List threads:
```bash
curl -sS "${CLAWMAIL_BASE_URL}/agent/inbox/threads" \
  -H "Authorization: Bearer ${CLAWMAIL_AGENT_TOKEN}"
```

- Get message:
```bash
curl -sS "${CLAWMAIL_BASE_URL}/agent/inbox/messages/<messageId>" \
  -H "Authorization: Bearer ${CLAWMAIL_AGENT_TOKEN}"
```

- Reply:
```bash
curl -sS -X POST "${CLAWMAIL_BASE_URL}/agent/inbox/reply" \
  -H "Authorization: Bearer ${CLAWMAIL_AGENT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"messageId":"<messageId>","body":"Thanks, received."}'
```

## Event and Webhook Flow

Gateway event feed:
- `GET /agent/events` returns recent webhook events scoped to the authenticated tenant/instance.

Webhook ingest endpoints:
- `POST /webhooks/mailchannels`
- `POST /webhooks/agentmail`

Operational notes:
- If configured, supply `x-webhook-secret` on webhook calls.
- Events are deduplicated by provider + provider event id + event type.
- Processed timestamp is recorded after acceptance.

## Common Failures

- `401 Missing agent token` or `Invalid or expired agent token`: token missing, revoked, or expired.
- `403 Token does not allow ...`: scope mismatch (`send` and/or `read_inbox` missing).
- `403 Instance is not active and cannot send`: suspended/deprovisioned instance.
- `404 No inbox provisioned for this instance`: run AgentMail inbox provisioning.
- `400 AgentMail is not connected for this tenant`: connect AgentMail credentials first.
- `404 MailChannels sub-account not provisioned`: provision MailChannels for that instance.
