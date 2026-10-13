import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { timingSafeEqual } from "node:crypto";
import {
  extractButtonReplies,
  extractInboundMessages,
  isValidSignature,
  processButtonReplies,
  processInboundMessages,
  type MetaWebhookBody,
} from "../services/whatsapp-decision.server";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// ---------------------------------------------------------------------------
// GET — webhook verification handshake
// ---------------------------------------------------------------------------

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!expectedToken) {
    console.error("[whatsapp] WHATSAPP_VERIFY_TOKEN is not set");
    return new Response("Webhook not configured", { status: 500 });
  }

  if (mode === "subscribe" && token && challenge && safeEqual(token, expectedToken)) {
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new Response("Forbidden", { status: 403 });
};

// ---------------------------------------------------------------------------
// POST — inbound events
// ---------------------------------------------------------------------------

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, POST" } });
  }

  let rawBody: Buffer;
  try {
    rawBody = Buffer.from(await request.arrayBuffer());
  } catch (error) {
    console.error(`[whatsapp] Could not read request body: ${errorMessage(error)}`);
    return new Response("Bad Request", { status: 400 });
  }

  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (appSecret) {
    if (!isValidSignature(rawBody, request.headers.get("x-hub-signature-256"), appSecret)) {
      console.warn("[whatsapp] Rejected webhook with invalid signature");
      return new Response("Invalid signature", { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    console.error("[whatsapp] WHATSAPP_APP_SECRET is not set; refusing unsigned webhooks");
    return new Response("Webhook not configured", { status: 500 });
  } else {
    console.warn("[whatsapp] WHATSAPP_APP_SECRET not set; skipping signature check (dev only)");
  }

  let body: MetaWebhookBody;
  try {
    const parsed: unknown = JSON.parse(rawBody.toString("utf8"));
    if (typeof parsed !== "object" || parsed === null) throw new Error("Body is not an object");
    body = parsed as MetaWebhookBody;
  } catch (error) {
    console.warn(`[whatsapp] Invalid JSON body: ${errorMessage(error)}`);
    return new Response("Bad Request", { status: 400 });
  }

  const inboundMessages = extractInboundMessages(body);
  if (inboundMessages.length > 0) {
    // Acknowledge immediately; Meta retries if we're slow to respond.
    void processInboundMessages(inboundMessages);
  } else {
    const replies = extractButtonReplies(body);
    if (replies.length > 0) {
      void processButtonReplies(replies);
    }
  }

  return new Response(null, { status: 200 });
};
