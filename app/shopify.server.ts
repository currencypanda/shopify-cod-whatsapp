import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY || "dummy_api_key",
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "dummy_api_secret",
  apiVersion: ApiVersion.January25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "https://example.com",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    expiringOfflineAccessTokens: true,
  },
  hooks: {
    afterAuth: async ({ session, admin }) => {
      shopify.registerWebhooks({ session });

      // Programmatically register ORDERS_CREATE webhook to catch orders without CLI PCD blockage
      try {
        const appUrl = (process.env.SHOPIFY_APP_URL || "").replace(/\/+$/, "");
        if (appUrl) {
          const callbackUrl = `${appUrl}/webhooks/app/orders/create`;
          const response = await admin.graphql(
            `#graphql
              mutation registerOrdersCreateWebhook($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
                webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
                  userErrors {
                    field
                    message
                  }
                  webhookSubscription {
                    id
                  }
                }
              }`,
            {
              variables: {
                topic: "ORDERS_CREATE",
                webhookSubscription: {
                  callbackUrl,
                  format: "JSON",
                },
              },
            },
          );

          const result = (await response.json()) as {
            data?: {
              webhookSubscriptionCreate?: {
                userErrors?: Array<{ field: string[]; message: string }>;
                webhookSubscription?: { id: string } | null;
              };
            };
          };

          const userErrors = result.data?.webhookSubscriptionCreate?.userErrors;
          if (userErrors && userErrors.length > 0) {
            console.warn(
              `[afterAuth] ORDERS_CREATE webhook registration notice for ${session.shop}:`,
              userErrors,
            );
          } else {
            console.log(
              `[afterAuth] Successfully registered ORDERS_CREATE webhook for ${session.shop}`,
            );
          }
        }
      } catch (error) {
        console.error(
          `[afterAuth] Failed to register ORDERS_CREATE webhook for ${session.shop}:`,
          error,
        );
      }
    },
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.January25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
