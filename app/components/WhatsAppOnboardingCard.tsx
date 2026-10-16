import React, { useState, useEffect } from "react";
import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Button,
  Box,
  Banner,
  Modal,
  TextField,
  Divider,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";

declare global {
  interface Window {
    fbAsyncInit?: () => void;
    FB?: any;
  }
}

interface WhatsAppOnboardingCardProps {
  wabaStatus: string;
  brandDisplayName: string | null;
  phoneNumberId: string | null;
  metaBillingActive: boolean;
  metaAppId?: string;
  shop: string;
  onRefresh?: () => void;
}

export function WhatsAppOnboardingCard({
  wabaStatus: initialWabaStatus,
  brandDisplayName: initialBrandDisplayName,
  phoneNumberId: initialPhoneNumberId,
  metaBillingActive: initialMetaBillingActive,
  metaAppId = "1234567890",
  shop,
  onRefresh,
}: WhatsAppOnboardingCardProps) {
  const shopify = useAppBridge();

  const [wabaStatus, setWabaStatus] = useState(initialWabaStatus || "DISCONNECTED");
  const [brandDisplayName, setBrandDisplayName] = useState(initialBrandDisplayName);
  const [phoneNumberId, setPhoneNumberId] = useState(initialPhoneNumberId);
  const [metaBillingActive, setMetaBillingActive] = useState(initialMetaBillingActive);
  const [isLoading, setIsLoading] = useState(false);

  // Manual / Developer Connect Dialog state (for sandboxes & quick setups)
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualPhoneId, setManualPhoneId] = useState("");
  const [manualWabaId, setManualWabaId] = useState("");
  const [manualToken, setManualToken] = useState("");
  const [manualBrandName, setManualBrandName] = useState("");

  useEffect(() => {
    setWabaStatus(initialWabaStatus || "DISCONNECTED");
    setBrandDisplayName(initialBrandDisplayName);
    setPhoneNumberId(initialPhoneNumberId);
    setMetaBillingActive(initialMetaBillingActive);
  }, [initialWabaStatus, initialBrandDisplayName, initialPhoneNumberId, initialMetaBillingActive]);

  // Load Meta Facebook SDK securely
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!window.FB) {
      window.fbAsyncInit = function () {
        window.FB.init({
          appId: metaAppId,
          autoLogAppEvents: true,
          xfbml: true,
          version: "v21.0",
        });
      };

      const scriptId = "facebook-jssdk";
      if (!document.getElementById(scriptId)) {
        const js = document.createElement("script");
        js.id = scriptId;
        js.src = "https://connect.facebook.net/en_US/sdk.js";
        js.async = true;
        js.defer = true;
        js.crossOrigin = "anonymous";
        document.body.appendChild(js);
      }
    }

    // Meta Embedded Signup event listener
    const handleMetaMessage = async (event: MessageEvent) => {
      if (
        event.origin.includes("facebook.com") &&
        event.data &&
        typeof event.data === "string"
      ) {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "WA_EMBEDDED_SIGNUP") {
            const { phone_number_id, waba_id } = data.data || {};
            if (phone_number_id || waba_id) {
              await handleExchangeToken({
                code: data.data?.code || "auth_code_embedded",
                phoneNumberId: phone_number_id,
                wabaId: waba_id,
              });
            }
          }
        } catch {
          // Non-JSON message from external frame
        }
      }
    };

    window.addEventListener("message", handleMetaMessage);
    return () => window.removeEventListener("message", handleMetaMessage);
  }, [metaAppId]);

  const handleExchangeToken = async (payload: {
    code?: string;
    wabaId?: string;
    phoneNumberId?: string;
    brandDisplayName?: string;
    metaAccessToken?: string;
  }) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/meta/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "connect",
          ...payload,
        }),
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Failed to link Meta WABA account.");
      }

      setWabaStatus("CONNECTED");
      setBrandDisplayName(result.config?.brandDisplayName || payload.brandDisplayName || "Official Brand");
      setPhoneNumberId(result.config?.phoneNumberId || payload.phoneNumberId || null);
      setMetaBillingActive(true);

      shopify.toast.show("Official WhatsApp Brand Connected Successfully!");
      onRefresh?.();
    } catch (err: any) {
      shopify.toast.show(err.message || "Failed to connect Meta account.", {
        isError: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLaunchMetaSignup = () => {
    if (window.FB) {
      window.FB.login(
        (response: any) => {
          if (response.authResponse?.code) {
            handleExchangeToken({
              code: response.authResponse.code,
            });
          } else {
            // If pop-up blocked or cancelled, provide developer quick connect
            setIsManualModalOpen(true);
          }
        },
        {
          scope: "whatsapp_business_management,whatsapp_business_messaging",
          extras: {
            feature: "whatsapp_embedded_signup",
            version: 2,
            sessionInfoVersion: 2,
          },
        },
      );
    } else {
      setIsManualModalOpen(true);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Are you sure you want to disconnect your official WhatsApp number? Messages will fall back to the managed cloud platform.")) {
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/meta/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });
      const data = await res.json();
      if (data.success) {
        setWabaStatus("DISCONNECTED");
        setBrandDisplayName(null);
        setPhoneNumberId(null);
        setMetaBillingActive(false);
        shopify.toast.show("WhatsApp disconnected. Fallback platform active.");
        onRefresh?.();
      }
    } catch (err: any) {
      shopify.toast.show(err.message || "Error disconnecting account", {
        isError: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isConnected = wabaStatus === "CONNECTED";

  return (
    <>
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <InlineStack gap="200" blockAlign="center">
              <span style={{ fontSize: "24px" }}>💬</span>
              <BlockStack gap="050">
                <InlineStack gap="150" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Official WhatsApp Brand Channel
                  </Text>
                  {isConnected ? (
                    <Badge tone="success">Active Brand Sender</Badge>
                  ) : (
                    <Badge tone="attention">Not Connected (Using Fallback)</Badge>
                  )}
                </InlineStack>
                <Text as="p" variant="bodySm" tone="subdued">
                  Meta Embedded Signup (Facebook Login for Business / BYOK)
                </Text>
              </BlockStack>
            </InlineStack>

            {isConnected ? (
              <Button
                variant="plain"
                tone="critical"
                onClick={handleDisconnect}
                loading={isLoading}
              >
                Disconnect / Switch Number
              </Button>
            ) : (
              <Button
                variant="plain"
                onClick={() => setIsManualModalOpen(true)}
              >
                Manual API Token Setup
              </Button>
            )}
          </InlineStack>

          <Divider />

          {isConnected ? (
            <Banner title="Official Brand Identity Active" tone="success">
              <BlockStack gap="200">
                <p>
                  Your store is sending verification messages directly from your registered
                  WhatsApp Business Account. Customers see your verified Brand Name and official logo.
                </p>
                <InlineGridLike>
                  <div>
                    <Text as="span" variant="bodyXs" tone="subdued">
                      VERIFIED BRAND NAME:
                    </Text>
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      {brandDisplayName || shop}
                    </Text>
                  </div>
                  <div>
                    <Text as="span" variant="bodyXs" tone="subdued">
                      DEDICATED PHONE ID:
                    </Text>
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      {phoneNumberId || "Dedicated Brand Line"}
                    </Text>
                  </div>
                  <div>
                    <Text as="span" variant="bodyXs" tone="subdued">
                      DIRECT META BILLING:
                    </Text>
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      {metaBillingActive ? "Active (Direct to Business Card)" : "Active"}
                    </Text>
                  </div>
                </InlineGridLike>
              </BlockStack>
            </Banner>
          ) : (
            <Banner
              title="Connect Your Official Brand WhatsApp in 1 Click"
              tone="info"
            >
              <BlockStack gap="300">
                <p>
                  Connect via Facebook to send messages with your official <strong>Brand Name</strong>,
                  profile picture, and verified badge. Meta message charges bill directly to your business
                  card with <strong>zero app markup</strong> ($0 developer billing risk).
                </p>
                <div>
                  <Button
                    variant="primary"
                    onClick={handleLaunchMetaSignup}
                    loading={isLoading}
                  >
                    📲 Connect Official WhatsApp via Meta
                  </Button>
                </div>
              </BlockStack>
            </Banner>
          )}
        </BlockStack>
      </Card>

      {/* Manual / Sandbox Modal for direct credentials entry */}
      <Modal
        open={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        title="Direct Meta WABA Credentials Setup"
        primaryAction={{
          content: "Save & Connect WABA",
          loading: isLoading,
          onAction: () => {
            handleExchangeToken({
              code: "manual_token_entry",
              phoneNumberId: manualPhoneId || undefined,
              wabaId: manualWabaId || undefined,
              metaAccessToken: manualToken || undefined,
              brandDisplayName: manualBrandName || undefined,
            });
            setIsManualModalOpen(false);
          },
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setIsManualModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <Text as="p" variant="bodySm">
              For sandbox testing or direct integration without Facebook popup, enter your
              Meta Cloud API credentials below:
            </Text>
            <TextField
              label="Brand Display Name"
              value={manualBrandName}
              onChange={setManualBrandName}
              placeholder="e.g. My Brand Official"
              autoComplete="off"
            />
            <TextField
              label="Phone Number ID"
              value={manualPhoneId}
              onChange={setManualPhoneId}
              placeholder="e.g. 104829103948291"
              autoComplete="off"
            />
            <TextField
              label="WhatsApp Business Account ID (WABA ID)"
              value={manualWabaId}
              onChange={setManualWabaId}
              placeholder="e.g. 293840192840192"
              autoComplete="off"
            />
            <TextField
              label="Permanent System User Access Token"
              value={manualToken}
              onChange={setManualToken}
              type="password"
              placeholder="EAAG..."
              autoComplete="off"
            />
          </BlockStack>
        </Modal.Section>
      </Modal>
    </>
  );
}

function InlineGridLike({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "12px",
        marginTop: "8px",
        padding: "10px",
        backgroundColor: "rgba(255, 255, 255, 0.6)",
        borderRadius: "8px",
      }}
    >
      {children}
    </div>
  );
}
