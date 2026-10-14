import { useState, useMemo, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  Box,
  Badge,
  InlineStack,
  InlineGrid,
  IndexTable,
  TextField,
  Select,
  Checkbox,
  Banner,
  Divider,
  ProgressBar,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { VerificationStatus } from "@prisma/client";
import {
  BILLING_PLANS,
  type BillingTierId,
  createAppSubscription,
} from "../services/billing.server";

// ---------------------------------------------------------------------------
// Loader — Fetch SaaS metrics, verifications & zero-config shop settings
// ---------------------------------------------------------------------------

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // 1. Retrieve or initialize ShopConfig with enterprise defaults
  let config = await db.shopConfig.findUnique({
    where: { shop },
  });

  if (!config) {
    config = await db.shopConfig.create({
      data: {
        shop,
        isEnabled: true,
        defaultCountryCode: "92",
        rtoCostEstimate: 450.0,
        currencySymbol: "PKR",
        autoCancelOnCustomerCancel: true,
        autoExpiryHours: 24,
        autoTagConfirmed: "COD-Confirmed",
        autoTagCancelled: "COD-Cancelled",
        autoTagExpired: "COD-Expired",
        autoTagAddressModified: "COD-Address-Modified",
        autoTagHold: "COD-Hold",
        botTone: "friendly",
        botLanguage: "auto",
        subscriptionTier: "STARTER",
        whatsappTemplateName: "cod_order_verification",
      },
    });
  }

  // 2. Fetch all verification orders for this shop (most recent first)
  const verifications = await db.verificationOrder.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // 3. Compute enterprise financial & operational metrics
  const totalOrders = await db.verificationOrder.count({ where: { shop } });
  const confirmedCount = await db.verificationOrder.count({
    where: { shop, status: VerificationStatus.CONFIRMED },
  });
  const cancelledCount = await db.verificationOrder.count({
    where: { shop, status: VerificationStatus.CANCELLED },
  });
  const pendingCount = await db.verificationOrder.count({
    where: { shop, status: VerificationStatus.PENDING },
  });
  const failedCount = await db.verificationOrder.count({
    where: { shop, status: VerificationStatus.FAILED },
  });
  const expiredCount = await db.verificationOrder.count({
    where: { shop, status: VerificationStatus.EXPIRED },
  });

  // Count of orders where customer modified address
  const addressCorrectedCount = await db.verificationOrder.count({
    where: {
      shop,
      OR: [
        { shippingAddress: { not: null } },
        { auditLog: { contains: "address" } },
      ],
    },
  });

  // Intercepted fake/rejected orders (cancelled by customer + expired unattended)
  const interceptedCount = cancelledCount + expiredCount;

  const conversionRate =
    totalOrders > 0 ? ((confirmedCount / totalOrders) * 100).toFixed(1) : "0.0";
  const interceptedRate =
    totalOrders > 0 ? ((interceptedCount / totalOrders) * 100).toFixed(1) : "0.0";

  // Financial ROI: Loss saved = intercepted orders × estimated return shipping cost
  const rtoCostEstimate = config.rtoCostEstimate ?? 450.0;
  const deliveryLossSaved = interceptedCount * rtoCostEstimate;

  // Monthly Usage against Plan Limit
  const billingTier = (config.subscriptionTier || "STARTER") as BillingTierId;
  const currentPlan = BILLING_PLANS[billingTier] || BILLING_PLANS.STARTER;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyUsageCount = await db.verificationOrder.count({
    where: { shop, createdAt: { gte: startOfMonth } },
  });

  // Central SaaS cloud WhatsApp service is active if server env credentials exist
  const isSaaSManagedActive = Boolean(
    process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN,
  );

  return json({
    config: {
      id: config.id,
      shop: config.shop,
      isEnabled: config.isEnabled,
      defaultCountryCode: config.defaultCountryCode ?? "92",
      rtoCostEstimate: config.rtoCostEstimate ?? 450.0,
      currencySymbol: config.currencySymbol ?? "PKR",
      autoCancelOnCustomerCancel: config.autoCancelOnCustomerCancel ?? true,
      autoExpiryHours: config.autoExpiryHours ?? 24,
      autoTagConfirmed: config.autoTagConfirmed ?? "COD-Confirmed",
      autoTagCancelled: config.autoTagCancelled ?? "COD-Cancelled",
      autoTagExpired: config.autoTagExpired ?? "COD-Expired",
      autoTagAddressModified: config.autoTagAddressModified ?? "COD-Address-Modified",
      autoTagHold: config.autoTagHold ?? "COD-Hold",
      botTone: config.botTone ?? "friendly",
      botLanguage: config.botLanguage ?? "auto",
      subscriptionTier: billingTier,
    },
    isSaaSManagedActive,
    metrics: {
      totalOrders,
      confirmedCount,
      cancelledCount,
      expiredCount,
      pendingCount,
      failedCount,
      interceptedCount,
      addressCorrectedCount,
      conversionRate,
      interceptedRate,
      deliveryLossSaved,
      monthlyUsageCount,
      billingTier,
      currentPlan,
    },
    verifications: verifications.map((v) => ({
      id: v.id,
      orderNumber: v.orderNumber,
      customerName: v.customerName,
      customerPhone: v.customerPhone,
      totalAmount: v.totalAmount.toString(),
      currency: v.currency,
      status: v.status,
      createdAt: v.createdAt.toISOString(),
      respondedAt: v.respondedAt ? v.respondedAt.toISOString() : null,
    })),
  });
};

// ---------------------------------------------------------------------------
// Action — Save merchant automation & ROI settings / Upgrade Subscription
// ---------------------------------------------------------------------------

type ActionData =
  | { success: true; message: string; confirmationUrl?: string }
  | { success: false; error: string };

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const intent = formData.get("intent")?.toString();

  if (intent === "save_settings") {
    const isEnabled = formData.get("isEnabled") === "true";
    const autoCancelOnCustomerCancel =
      formData.get("autoCancelOnCustomerCancel") === "true";
    const autoExpiryHours =
      parseInt(formData.get("autoExpiryHours")?.toString() || "24", 10) || 0;
    const rtoCostEstimate =
      parseFloat(formData.get("rtoCostEstimate")?.toString() || "450.0") ||
      450.0;
    const currencySymbol =
      formData.get("currencySymbol")?.toString().trim() || "PKR";
    const defaultCountryCode =
      formData.get("defaultCountryCode")?.toString().trim() || "92";
    const autoTagConfirmed =
      formData.get("autoTagConfirmed")?.toString().trim() || "COD-Confirmed";
    const autoTagCancelled =
      formData.get("autoTagCancelled")?.toString().trim() || "COD-Cancelled";
    const autoTagExpired =
      formData.get("autoTagExpired")?.toString().trim() || "COD-Expired";
    const autoTagAddressModified =
      formData.get("autoTagAddressModified")?.toString().trim() ||
      "COD-Address-Modified";
    const autoTagHold =
      formData.get("autoTagHold")?.toString().trim() || "COD-Hold";
    const botTone = formData.get("botTone")?.toString().trim() || "friendly";
    const botLanguage =
      formData.get("botLanguage")?.toString().trim() || "auto";

    await db.shopConfig.upsert({
      where: { shop },
      create: {
        shop,
        isEnabled,
        autoCancelOnCustomerCancel,
        autoExpiryHours,
        rtoCostEstimate,
        currencySymbol,
        defaultCountryCode,
        autoTagConfirmed,
        autoTagCancelled,
        autoTagExpired,
        autoTagAddressModified,
        autoTagHold,
        botTone,
        botLanguage,
        whatsappTemplateName: "cod_order_verification",
      },
      update: {
        isEnabled,
        autoCancelOnCustomerCancel,
        autoExpiryHours,
        rtoCostEstimate,
        currencySymbol,
        defaultCountryCode,
        autoTagConfirmed,
        autoTagCancelled,
        autoTagExpired,
        autoTagAddressModified,
        autoTagHold,
        botTone,
        botLanguage,
      },
    });

    return json<ActionData>({
      success: true,
      message: "Enterprise settings saved successfully",
    });
  }

  if (intent === "upgrade_plan") {
    const planId = formData.get("planId")?.toString() as "PRO" | "ENTERPRISE";
    if (planId !== "PRO" && planId !== "ENTERPRISE") {
      return json<ActionData>(
        { success: false, error: "Invalid plan selected" },
        { status: 400 },
      );
    }

    const host = new URL(request.url).origin;
    const returnUrl = `${host}/app`;

    const result = await createAppSubscription({
      admin,
      shop,
      planId,
      returnUrl,
      isTest: true,
    });

    if (result.errors && result.errors.length > 0) {
      return json<ActionData>({
        success: false,
        error: result.errors.join(", "),
      });
    }

    return json<ActionData>({
      success: true,
      message: `Subscription initiated for ${planId} plan.`,
      confirmationUrl: result.confirmationUrl,
    });
  }

  return json<ActionData>(
    { success: false, error: "Invalid request" },
    { status: 400 },
  );
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStatusTone(
  status: string,
): "attention" | "success" | "critical" | "read-only" | "info" {
  switch (status) {
    case "PENDING":
      return "attention"; // Amber
    case "CONFIRMED":
      return "success"; // Green
    case "CANCELLED":
      return "critical"; // Red
    case "EXPIRED":
      return "read-only"; // Neutral
    case "FAILED":
      return "critical";
    default:
      return "info";
  }
}

function formatDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

// ---------------------------------------------------------------------------
// Merchant Dashboard Component
// ---------------------------------------------------------------------------

export default function Index() {
  const { config, isSaaSManagedActive, metrics, verifications } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const isSubmitting =
    fetcher.state === "submitting" || fetcher.state === "loading";

  // Plug-and-Play Merchant Form State
  const [isEnabled, setIsEnabled] = useState(config.isEnabled);
  const [autoCancelOnCustomerCancel, setAutoCancelOnCustomerCancel] = useState(
    config.autoCancelOnCustomerCancel,
  );
  const [autoExpiryHours, setAutoExpiryHours] = useState(
    config.autoExpiryHours.toString(),
  );
  const [rtoCostEstimate, setRtoCostEstimate] = useState(
    config.rtoCostEstimate.toString(),
  );
  const [currencySymbol, setCurrencySymbol] = useState(config.currencySymbol);
  const [defaultCountryCode, setDefaultCountryCode] = useState(
    config.defaultCountryCode,
  );
  const [autoTagConfirmed, setAutoTagConfirmed] = useState(
    config.autoTagConfirmed,
  );
  const [autoTagCancelled, setAutoTagCancelled] = useState(
    config.autoTagCancelled,
  );
  const [autoTagExpired, setAutoTagExpired] = useState(config.autoTagExpired);
  const [autoTagAddressModified, setAutoTagAddressModified] = useState(
    config.autoTagAddressModified,
  );
  const [autoTagHold, setAutoTagHold] = useState(config.autoTagHold);
  const [botTone, setBotTone] = useState(config.botTone);
  const [botLanguage, setBotLanguage] = useState(config.botLanguage);

  // Search & Filter state for verifications table
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");

  // Keep form fields synced if loader re-runs
  useEffect(() => {
    setIsEnabled(config.isEnabled);
    setAutoCancelOnCustomerCancel(config.autoCancelOnCustomerCancel);
    setAutoExpiryHours(config.autoExpiryHours.toString());
    setRtoCostEstimate(config.rtoCostEstimate.toString());
    setCurrencySymbol(config.currencySymbol);
    setDefaultCountryCode(config.defaultCountryCode);
    setAutoTagConfirmed(config.autoTagConfirmed);
    setAutoTagCancelled(config.autoTagCancelled);
    setAutoTagExpired(config.autoTagExpired);
    setAutoTagAddressModified(config.autoTagAddressModified);
    setAutoTagHold(config.autoTagHold);
    setBotTone(config.botTone);
    setBotLanguage(config.botLanguage);
  }, [config]);

  // Show App Bridge toast notification upon save or redirect to confirmation URL
  useEffect(() => {
    if (!fetcher.data) return;

    if (fetcher.data.success) {
      if (fetcher.data.confirmationUrl) {
        window.top?.location.assign(fetcher.data.confirmationUrl);
      } else {
        shopify.toast.show(fetcher.data.message);
      }
    } else {
      shopify.toast.show(fetcher.data.error, { isError: true });
    }
  }, [fetcher.data, shopify]);

  // Filtered verifications list
  const filteredOrders = useMemo(() => {
    return verifications.filter((order) => {
      const matchesStatus =
        selectedStatus === "ALL" || order.status === selectedStatus;
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        order.orderNumber.toLowerCase().includes(query) ||
        (order.customerName &&
          order.customerName.toLowerCase().includes(query)) ||
        order.customerPhone.toLowerCase().includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [verifications, searchQuery, selectedStatus]);

  const usagePercent = useMemo(() => {
    if (metrics.currentPlan.orderLimit === -1) return 10;
    return Math.min(
      100,
      Math.round(
        (metrics.monthlyUsageCount / metrics.currentPlan.orderLimit) * 100,
      ),
    );
  }, [metrics.monthlyUsageCount, metrics.currentPlan.orderLimit]);

  return (
    <Page fullWidth>
      <TitleBar title="COD WhatsApp Verification & RTO Protection" />
      <BlockStack gap="500">
        {/* Managed Cloud Infrastructure Reassurance Banner */}
        {isSaaSManagedActive ? (
          <Banner title="Managed Cloud Verification Active" tone="success">
            <p>
              Your store is protected by our automated Cash on Delivery verification service.
              Buyers receive instant, localized WhatsApp verification buttons with zero Meta API configuration required.
            </p>
          </Banner>
        ) : (
          <Banner title="Service Operational in Development Mode" tone="info">
            <p>
              The verification engine is ready to intercept and verify incoming COD orders.
            </p>
          </Banner>
        )}

        {/* 1. Polaris Analytics KPI Metric Cards */}
        <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm" tone="subdued">
                Total Orders Processed
              </Text>
              <Text as="p" variant="headingXl">
                {metrics.totalOrders.toLocaleString()}
              </Text>
              <Text as="span" variant="bodySm" tone="subdued">
                All Cash on Delivery orders intercepted
              </Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm" tone="subdued">
                Verified Rate
              </Text>
              <InlineStack align="space-between" blockAlign="center">
                <Text as="p" variant="headingXl">
                  {metrics.confirmedCount.toLocaleString()}
                </Text>
                <Badge tone="success">
                  {`${metrics.conversionRate}% verified`}
                </Badge>
              </InlineStack>
              <Text as="span" variant="bodySm" tone="subdued">
                Safe to pack & hand over to courier
              </Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm" tone="subdued">
                Addresses Corrected
              </Text>
              <InlineStack align="space-between" blockAlign="center">
                <Text as="p" variant="headingXl">
                  {metrics.addressCorrectedCount.toLocaleString()}
                </Text>
                <Badge tone="info">Updated via WhatsApp</Badge>
              </InlineStack>
              <Text as="span" variant="bodySm" tone="subdued">
                Synced automatically to Shopify Admin
              </Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm" tone="subdued">
                Estimated Courier Cost Saved
              </Text>
              <InlineStack align="space-between" blockAlign="center">
                <Text as="p" variant="headingXl">
                  {`${config.currencySymbol} ${metrics.deliveryLossSaved.toLocaleString()}`}
                </Text>
                <Badge tone="success">Saved</Badge>
              </InlineStack>
              <Text as="span" variant="bodySm" tone="subdued">
                {`Intercepted ${metrics.interceptedCount} fake/unattended orders`}
              </Text>
            </BlockStack>
          </Card>
        </InlineGrid>

        {/* 2. Subscription & Plan Quota Progress Card */}
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
              <InlineStack gap="200" blockAlign="center">
                <Text as="h2" variant="headingMd">
                  Active Subscription Tier:
                </Text>
                <Badge
                  tone={
                    metrics.billingTier === "ENTERPRISE"
                      ? "magic"
                      : metrics.billingTier === "PRO"
                        ? "success"
                        : "info"
                  }
                >
                  {metrics.currentPlan.name}
                </Badge>
              </InlineStack>
              <Text as="span" variant="bodySm" tone="subdued">
                {metrics.currentPlan.orderLimit === -1
                  ? "Unlimited verifications included"
                  : `${metrics.monthlyUsageCount} / ${metrics.currentPlan.orderLimit} verifications used this month`}
              </Text>
            </InlineStack>

            <ProgressBar
              progress={usagePercent}
              tone={usagePercent > 90 ? "critical" : "primary"}
              size="small"
            />

            <InlineGrid columns={{ xs: 1, sm: 3 }} gap="300">
              <Box
                padding="300"
                borderWidth="025"
                borderColor="border"
                borderRadius="200"
              >
                <BlockStack gap="100">
                  <Text as="h3" variant="headingSm">
                    Starter Plan ($0/mo)
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    50 verifications/mo • 1-Click WhatsApp buttons
                  </Text>
                  {metrics.billingTier === "STARTER" ? (
                    <Badge tone="info">Current Active Plan</Badge>
                  ) : null}
                </BlockStack>
              </Box>

              <Box
                padding="300"
                borderWidth="025"
                borderColor="border"
                borderRadius="200"
              >
                <BlockStack gap="100">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h3" variant="headingSm">
                      Pro Tier ($29/mo)
                    </Text>
                    {metrics.billingTier === "PRO" ? (
                      <Badge tone="success">Current Active</Badge>
                    ) : (
                      <fetcher.Form method="post">
                        <input type="hidden" name="intent" value="upgrade_plan" />
                        <input type="hidden" name="planId" value="PRO" />
                        <Button submit size="micro" variant="primary">
                          Upgrade
                        </Button>
                      </fetcher.Form>
                    )}
                  </InlineStack>
                  <Text as="p" variant="bodySm" tone="subdued">
                    1,000 orders • Multi-market & Address edit • Auto-restock
                  </Text>
                </BlockStack>
              </Box>

              <Box
                padding="300"
                borderWidth="025"
                borderColor="border"
                borderRadius="200"
              >
                <BlockStack gap="100">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h3" variant="headingSm">
                      Enterprise Tier ($79/mo)
                    </Text>
                    {metrics.billingTier === "ENTERPRISE" ? (
                      <Badge tone="magic">Current Active</Badge>
                    ) : (
                      <fetcher.Form method="post">
                        <input
                          type="hidden"
                          name="intent"
                          value="upgrade_plan"
                        />
                        <input type="hidden" name="planId" value="ENTERPRISE" />
                        <Button submit size="micro" variant="primary">
                          Upgrade
                        </Button>
                      </fetcher.Form>
                    )}
                  </InlineStack>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Unlimited orders • High-throughput route • Custom SLAs
                  </Text>
                </BlockStack>
              </Box>
            </InlineGrid>
          </BlockStack>
        </Card>

        {/* 3. Main Content Grid: Verifications Table + Plug-and-Play Controls */}
        <Layout>
          {/* Recent Verifications Live Table */}
          <Layout.Section>
            <Card padding="0">
              <Box padding="400">
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingMd">
                      Recent COD Verifications
                    </Text>
                    <Badge tone="info">
                      {`${filteredOrders.length} ${filteredOrders.length === 1 ? "order" : "orders"}`}
                    </Badge>
                  </InlineStack>
                  <InlineGrid columns={{ xs: 1, sm: "2fr 1fr" }} gap="300">
                    <TextField
                      label="Search orders"
                      labelHidden
                      placeholder="Search by order #, customer name, or phone"
                      value={searchQuery}
                      onChange={setSearchQuery}
                      clearButton
                      onClearButtonClick={() => setSearchQuery("")}
                      autoComplete="off"
                    />
                    <Select
                      label="Filter by status"
                      labelHidden
                      options={[
                        { label: "All Statuses", value: "ALL" },
                        { label: "Confirmed", value: "CONFIRMED" },
                        { label: "Pending Verification", value: "PENDING_VERIFICATION" },
                        { label: "Address Input Awaiting", value: "AWAITING_ADDRESS_INPUT" },
                        { label: "Cancelled", value: "CANCELLED" },
                        { label: "Expired", value: "EXPIRED" },
                        { label: "Failed", value: "FAILED" },
                      ]}
                      value={selectedStatus}
                      onChange={setSelectedStatus}
                    />
                  </InlineGrid>
                </BlockStack>
              </Box>

              <IndexTable
                resourceName={{ singular: "verification", plural: "verifications" }}
                itemCount={filteredOrders.length}
                headings={[
                  { title: "Order #" },
                  { title: "Customer" },
                  { title: "Phone" },
                  { title: "Amount" },
                  { title: "Status" },
                  { title: "Date" },
                ]}
                selectable={false}
              >
                {filteredOrders.length === 0 ? (
                  <IndexTable.Row id="empty" position={0}>
                    <IndexTable.Cell colSpan={6}>
                      <Box padding="600">
                        <BlockStack align="center" inlineAlign="center" gap="200">
                          <Text as="p" variant="bodyMd" tone="subdued">
                            No verification records match your filter criteria.
                          </Text>
                        </BlockStack>
                      </Box>
                    </IndexTable.Cell>
                  </IndexTable.Row>
                ) : (
                  filteredOrders.map(
                    (
                      {
                        id,
                        orderNumber,
                        customerName,
                        customerPhone,
                        totalAmount,
                        currency,
                        status,
                        createdAt,
                      },
                      index,
                    ) => (
                      <IndexTable.Row id={id} key={id} position={index}>
                        <IndexTable.Cell>
                          <Text as="span" variant="bodyMd" fontWeight="semibold">
                            {orderNumber}
                          </Text>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          {customerName || (
                            <Text as="span" tone="subdued">
                              —
                            </Text>
                          )}
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Text as="span" variant="bodySm">
                            {customerPhone}
                          </Text>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Text as="span" variant="bodySm" fontWeight="medium">
                            {`${currency} ${totalAmount}`}
                          </Text>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Badge tone={getStatusTone(status)}>
                            {status.replace(/_/g, " ")}
                          </Badge>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Text as="span" variant="bodySm" tone="subdued">
                            {formatDateTime(createdAt)}
                          </Text>
                        </IndexTable.Cell>
                      </IndexTable.Row>
                    ),
                  )
                )}
              </IndexTable>
            </Card>
          </Layout.Section>

          {/* Plug-and-Play Merchant Controls Sidebar */}
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="400">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd">
                    Automation & Tagging Rules
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Configure WhatsApp bot personality, auto-expiry, and Shopify Admin order tags.
                  </Text>
                </BlockStack>
                <Divider />

                <fetcher.Form method="post">
                  <input type="hidden" name="intent" value="save_settings" />
                  <BlockStack gap="400">
                    {/* Main Power Switch */}
                    <Checkbox
                      label="Enable Automated COD Verification"
                      helpText="Automatically send WhatsApp confirmation buttons to Cash on Delivery customers upon checkout"
                      checked={isEnabled}
                      onChange={setIsEnabled}
                    />
                    <input
                      type="hidden"
                      name="isEnabled"
                      value={isEnabled ? "true" : "false"}
                    />

                    {/* Auto-Cancellation Switch */}
                    <Checkbox
                      label="Automatically Cancel & Restock Rejected Orders"
                      helpText="Instantly cancels the order and restores inventory in Shopify when a buyer taps 'Cancel' in WhatsApp"
                      checked={autoCancelOnCustomerCancel}
                      onChange={setAutoCancelOnCustomerCancel}
                    />
                    <input
                      type="hidden"
                      name="autoCancelOnCustomerCancel"
                      value={autoCancelOnCustomerCancel ? "true" : "false"}
                    />

                    {/* Bot Tone Selector */}
                    <Select
                      label="WhatsApp Bot Tone"
                      name="botTone"
                      options={[
                        { label: "Friendly & Conversational (Default)", value: "friendly" },
                        { label: "Urgent & High-Conversion", value: "urgent" },
                        { label: "Formal & Professional", value: "formal" },
                      ]}
                      value={botTone}
                      onChange={setBotTone}
                      helpText="Adjusts greeting and action prompts sent to shoppers"
                    />

                    {/* Bot Language Override */}
                    <Select
                      label="WhatsApp Bot Language"
                      name="botLanguage"
                      options={[
                        { label: "Auto-detect (Market & Phone Locale)", value: "auto" },
                        { label: "Arabic - العربية (GCC & Middle East)", value: "ar" },
                        { label: "Spanish - Español", value: "es" },
                        { label: "English (Global Standard)", value: "en" },
                        { label: "Urdu - اردو (Pakistan)", value: "ur" },
                      ]}
                      value={botLanguage}
                      onChange={setBotLanguage}
                      helpText="Force a specific language or dynamically detect from phone country"
                    />

                    {/* Auto-Expiry / Grace Period Window Dropdown */}
                    <Select
                      label="Auto-Cancel Grace Period"
                      name="autoExpiryHours"
                      options={[
                        { label: "12 Hours (Fast Dispatch)", value: "12" },
                        { label: "24 Hours (Standard Recommended)", value: "24" },
                        { label: "48 Hours (Extended)", value: "48" },
                        { label: "Disabled (Never auto-cancel unattended orders)", value: "0" },
                      ]}
                      value={autoExpiryHours}
                      onChange={setAutoExpiryHours}
                      helpText="Orders left unanswered after this window are tagged and expired"
                    />

                    {/* Estimated Courier Return Loss Metric Input */}
                    <TextField
                      label="Average Courier Return Loss"
                      name="rtoCostEstimate"
                      type="number"
                      step={1}
                      min={0}
                      value={rtoCostEstimate}
                      onChange={setRtoCostEstimate}
                      placeholder="450"
                      helpText="Estimated courier loss per returned package to compute total ROI saved"
                      autoComplete="off"
                    />

                    <Divider />
                    <Text as="h3" variant="headingSm">
                      Shopify Admin Auto-Tagging
                    </Text>

                    <InlineGrid columns={2} gap="200">
                      <TextField
                        label="Currency Symbol"
                        name="currencySymbol"
                        value={currencySymbol}
                        onChange={setCurrencySymbol}
                        placeholder="PKR"
                        autoComplete="off"
                      />
                      <TextField
                        label="Dialing Code"
                        name="defaultCountryCode"
                        value={defaultCountryCode}
                        onChange={setDefaultCountryCode}
                        placeholder="92"
                        helpText="e.g. 92, 1, 971"
                        autoComplete="off"
                      />
                    </InlineGrid>

                    <TextField
                      label="Tag for Confirmed Orders"
                      name="autoTagConfirmed"
                      value={autoTagConfirmed}
                      onChange={setAutoTagConfirmed}
                      placeholder="COD-Confirmed"
                      autoComplete="off"
                    />

                    <TextField
                      label="Tag for Address Modified"
                      name="autoTagAddressModified"
                      value={autoTagAddressModified}
                      onChange={setAutoTagAddressModified}
                      placeholder="COD-Address-Modified"
                      autoComplete="off"
                    />

                    <TextField
                      label="Tag for Orders on Hold"
                      name="autoTagHold"
                      value={autoTagHold}
                      onChange={setAutoTagHold}
                      placeholder="COD-Hold"
                      autoComplete="off"
                    />

                    <TextField
                      label="Tag for Cancelled Orders"
                      name="autoTagCancelled"
                      value={autoTagCancelled}
                      onChange={setAutoTagCancelled}
                      placeholder="COD-Cancelled"
                      autoComplete="off"
                    />

                    <TextField
                      label="Tag for Expired Orders"
                      name="autoTagExpired"
                      value={autoTagExpired}
                      onChange={setAutoTagExpired}
                      placeholder="COD-Expired"
                      autoComplete="off"
                    />

                    <Box paddingBlockStart="200">
                      <Button submit variant="primary" loading={isSubmitting} fullWidth>
                        Save Settings
                      </Button>
                    </Box>
                  </BlockStack>
                </fetcher.Form>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
