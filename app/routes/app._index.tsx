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
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { VerificationStatus } from "@prisma/client";

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

  // Intercepted fake/rejected orders (cancelled by customer + expired unattended)
  const interceptedCount = cancelledCount + expiredCount;

  const conversionRate =
    totalOrders > 0 ? ((confirmedCount / totalOrders) * 100).toFixed(1) : "0.0";
  const interceptedRate =
    totalOrders > 0 ? ((interceptedCount / totalOrders) * 100).toFixed(1) : "0.0";

  // Financial ROI: Loss saved = intercepted orders × estimated return shipping cost
  const rtoCostEstimate = config.rtoCostEstimate ?? 450.0;
  const deliveryLossSaved = interceptedCount * rtoCostEstimate;

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
      conversionRate,
      interceptedRate,
      deliveryLossSaved,
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
// Action — Save merchant automation & ROI settings
// ---------------------------------------------------------------------------

type ActionData =
  | { success: true; message: string }
  | { success: false; error: string };

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const intent = formData.get("intent")?.toString();

  if (intent === "save_settings") {
    const isEnabled = formData.get("isEnabled") === "true";
    const autoCancelOnCustomerCancel =
      formData.get("autoCancelOnCustomerCancel") === "true";
    const autoExpiryHours =
      parseInt(formData.get("autoExpiryHours")?.toString() || "24", 10) || 24;
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
      },
    });

    return json<ActionData>({
      success: true,
      message: "Settings saved successfully",
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
  }, [config]);

  // Show App Bridge toast notification upon save
  useEffect(() => {
    if (!fetcher.data) return;

    if (fetcher.data.success) {
      shopify.toast.show(fetcher.data.message);
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

  return (
    <Page fullWidth>
      <TitleBar title="COD WhatsApp Verification & RTO Protection" />
      <BlockStack gap="500">
        {/* Managed Cloud Infrastructure Reassurance Banner */}
        {isSaaSManagedActive ? (
          <Banner title="Managed Cloud Verification Active" tone="success">
            <p>
              Your store is protected by our automated Cash on Delivery verification service.
              Buyers receive instant, branded WhatsApp verification buttons with zero Meta API configuration required.
            </p>
          </Banner>
        ) : (
          <Banner title="Service Operational in Development Mode" tone="info">
            <p>
              The verification engine is ready to intercept and verify incoming COD orders.
            </p>
          </Banner>
        )}

        {/* 1. High-Impact Financial ROI & Loss-Saved Analytics Cards */}
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
                Verified & Dispatched
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
                Fake / Rejected Intercepted
              </Text>
              <InlineStack align="space-between" blockAlign="center">
                <Text as="p" variant="headingXl">
                  {metrics.interceptedCount.toLocaleString()}
                </Text>
                <Badge tone="critical">
                  {`${metrics.interceptedRate}% intercepted`}
                </Badge>
              </InlineStack>
              <Text as="span" variant="bodySm" tone="subdued">
                {`${metrics.cancelledCount} rejected + ${metrics.expiredCount} unattended expired`}
              </Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm" tone="subdued">
                Delivery & RTO Money Saved
              </Text>
              <InlineStack align="space-between" blockAlign="center">
                <Text as="p" variant="headingXl">
                  {`${config.currencySymbol} ${metrics.deliveryLossSaved.toLocaleString()}`}
                </Text>
                <Badge tone="success">Saved</Badge>
              </InlineStack>
              <Text as="span" variant="bodySm" tone="subdued">
                {`Saved @ ${config.currencySymbol} ${config.rtoCostEstimate} avg return shipment cost`}
              </Text>
            </BlockStack>
          </Card>
        </InlineGrid>

        {/* 2. Main Content Grid: Verifications Table + Plug-and-Play Controls */}
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
                        { label: "Pending Verification", value: "PENDING" },
                        { label: "Confirmed (Verified)", value: "CONFIRMED" },
                        { label: "Cancelled (Rejected)", value: "CANCELLED" },
                        { label: "Expired (Unanswered)", value: "EXPIRED" },
                        { label: "Failed", value: "FAILED" },
                      ]}
                      value={selectedStatus}
                      onChange={setSelectedStatus}
                    />
                  </InlineGrid>
                </BlockStack>
              </Box>
              <Divider />

              {filteredOrders.length === 0 ? (
                <Box padding="800">
                  <BlockStack align="center" inlineAlign="center" gap="200">
                    <Text
                      as="p"
                      variant="bodyMd"
                      tone="subdued"
                      alignment="center"
                    >
                      {verifications.length === 0
                        ? "No COD orders recorded yet. Incoming Cash on Delivery orders will appear here automatically."
                        : "No verification orders match the search query or status filter."}
                    </Text>
                  </BlockStack>
                </Box>
              ) : (
                <IndexTable
                  resourceName={{
                    singular: "order verification",
                    plural: "order verifications",
                  }}
                  itemCount={filteredOrders.length}
                  headings={[
                    { title: "Order #" },
                    { title: "Customer Name" },
                    { title: "Phone" },
                    { title: "Order Total" },
                    { title: "Verification Status" },
                    { title: "Date & Time" },
                  ]}
                  selectable={false}
                >
                  {filteredOrders.map((order, index) => (
                    <IndexTable.Row
                      id={order.id}
                      key={order.id}
                      position={index}
                    >
                      <IndexTable.Cell>
                        <Text as="span" variant="bodyMd" fontWeight="bold">
                          {order.orderNumber}
                        </Text>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        {order.customerName || "—"}
                      </IndexTable.Cell>
                      <IndexTable.Cell>{order.customerPhone}</IndexTable.Cell>
                      <IndexTable.Cell>
                        {`${order.currency} ${order.totalAmount}`}
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Badge tone={getStatusTone(order.status)}>
                          {order.status}
                        </Badge>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        {formatDateTime(order.createdAt)}
                      </IndexTable.Cell>
                    </IndexTable.Row>
                  ))}
                </IndexTable>
              )}
            </Card>
          </Layout.Section>

          {/* 3. Plug-and-Play Merchant Controls (Zero Technical Jargon) */}
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="400">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd">
                    Plug-and-Play Controls
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Configure your automated verification rules and return loss settings.
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

                    {/* Auto-Expiry Window Dropdown */}
                    <Select
                      label="Unattended Order Expiry Window"
                      name="autoExpiryHours"
                      options={[
                        { label: "12 Hours", value: "12" },
                        { label: "24 Hours (Recommended)", value: "24" },
                        { label: "48 Hours", value: "48" },
                        { label: "72 Hours", value: "72" },
                      ]}
                      value={autoExpiryHours}
                      onChange={setAutoExpiryHours}
                      helpText="Mark unanswered orders as expired after this duration"
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
                      helpText="Your average 2-way courier delivery fee lost when a rejected COD order is returned (used to calculate Money Saved)"
                      autoComplete="off"
                    />

                    <Divider />
                    <Text as="h3" variant="headingSm">
                      Store Tags & Localization
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
