# Shopify App Review Instructions: SwiftCOD (WhatsApp COD Verify)

**For Shopify App Review Quality Assurance Staff**  
**App Name:** SwiftCOD: WhatsApp Verify  
**App Category:** Orders & Shipping, Fraud Prevention, Customer Communications  
**Platform Version:** Shopify Remix App Template (Vite, Polaris 12, App Bridge 4)  
**Database:** PostgreSQL (Supabase with connection pooling)  
**Production Host:** Render Cloud Services  

---

## 1. Quick Review Summary & Architecture

SwiftCOD is a **Zero-Config Managed SaaS application** designed to eliminate Return-to-Origin (RTO) courier losses for merchants accepting Cash on Delivery (COD).

### Key Architectural Highlights for Reviewers:
1. **Zero Technical Setup Required:** The merchant does **not** need to register on Meta Business Manager, create WhatsApp apps, or configure access tokens. Dispatches are securely routed through our pre-approved SaaS platform gateway.
2. **Shopify Admin Embedded UI:** Built entirely in modern **Shopify Polaris 12** components matching native Shopify design guidelines.
3. **Automated Order Ingestion:** Ingests Shopify `orders/create` webhook events, validates payment gateway (filtering for `manual` / Cash on Delivery), and sends interactive WhatsApp messages.
4. **Interactive 2-Way Quick-Reply:** Listens to customer button taps ([Confirm Order] / [Cancel Order]), automatically tagging orders, cancelling rejected orders, and restocking inventory.
5. **GDPR / Compliance Webhooks:** Fully implemented endpoints for Customer Data Request, Customer Redact, and Shop Redact.

---

## 2. Test Store Setup & Reviewer Credentials

* **Target Test Store:** `ahmed-cod-test.myshopify.com`
* **App URL:** Embedded directly inside Shopify Admin under **Apps > SwiftCOD: WhatsApp Verify**
* **Reviewer Test Phone Number:** Any valid E.164 phone number (or use the simulated interactive test suite detailed below).

---

## 3. Step-by-Step QA Verification Workflow

### Step A: Accessing the Embedded App Dashboard
1. Open your test Shopify store Admin (`https://admin.shopify.com/store/{your-store}`).
2. Navigate to **Apps** and click on **SwiftCOD: WhatsApp Verify**.
3. Verify that the dashboard loads smoothly:
   - **Header Title:** "SwiftCOD Automation & RTO Loss Dashboard"
   - **Financial ROI Metrics:** 3 metric cards displaying:
     - *Verified & Dispatched Orders*
     - *Fake / Rejected Orders Intercepted*
     - *Total Delivery & RTO Money Saved*
   - **Merchant Controls:** Toggle switches for "Enable Automated COD Verification", "Auto-Cancel & Restock Rejected Orders", and the "Unattended Order Expiry Window" dropdown (12h, 24h, 48h).

---

### Step B: Placing a Test COD Order in Shopify
1. In Shopify Admin, navigate to **Orders > Create order** (or place an order via the storefront using Cash on Delivery).
2. Add any test product (e.g., $25.00).
3. Under **Customer**, assign a customer name (e.g., `Shopify QA Reviewer`) and enter a test phone number with country code (e.g., `+1 555-0199` or `+92 320 3737570`).
4. Under **Payment**, select **Cash on Delivery (COD)** (or "Mark as payment pending").
5. Click **Create order** (or **Complete order**).
6. **Observed System Behavior:**
   - SwiftCOD immediately captures the `orders/create` webhook.
   - The phone number is normalized to E.164 standard.
   - The order is logged in the database with status `PENDING`.
   - The WhatsApp verification message is dispatched to the customer's phone.

---

### Step C: Testing the Customer 1-Click Decision

Because real Meta WhatsApp message delivery requires an active phone registered with WhatsApp, SwiftCOD provides both **live message delivery** and an automated **simulation test harness** for QA reviewers to verify both branches of the state machine without needing a physical phone.

#### Scenario 1: Customer Taps "Confirm Order"
* **Action:** The customer clicks the native **Confirm Order** button in WhatsApp (or reviewer triggers confirmation via the API endpoint).
* **Observed System Behavior:**
  1. The database record status updates from `PENDING` to `CONFIRMED`.
  2. In Shopify Admin, the order timeline records the verification event.
  3. The tag **`COD-Confirmed`** is automatically appended to the Shopify Order tags.
  4. The merchant dashboard increments the "Verified & Dispatched Orders" counter.

#### Scenario 2: Customer Taps "Cancel Order"
* **Action:** The customer clicks the **Cancel Order** button in WhatsApp.
* **Observed System Behavior:**
  1. The database record status updates from `PENDING` to `CANCELLED`.
  2. The tag **`COD-Cancelled`** is applied to the Shopify Order tags.
  3. SwiftCOD executes the Shopify GraphQL mutation `orderCancel` with `restock: true`.
  4. The Shopify order is updated to **Cancelled**, the payment status is marked **Voided**, and line item inventory is returned to available stock.
  5. The merchant dashboard increments the "Fake / Rejected Orders Intercepted" counter and increases "Total Delivery & RTO Money Saved".

---

### Step D: Verifying the Auto-Expiry Cron Job
Orders left unattended by customers for longer than the merchant's configured threshold (default: 24 hours) are processed by the automated background worker:
* The order status transitions from `PENDING` to `EXPIRED`.
* The tag **`COD-Expired`** is attached to the Shopify Order.
* Fulfillment staff are alerted that the customer did not verify their contact information, preventing shipping loss.

---

## 4. Mandatory Privacy & Compliance Verification (cURL Tests)

Shopify QA reviewers can verify that our mandatory privacy compliance endpoints respond with `HTTP 200 OK` using standard cURL commands:

### 1. Customer Data Request
```bash
curl -X POST "https://shopify-cod-whatsapp.onrender.com/api/webhooks/customers/data_request" \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Hmac-Sha256: test_mock_signature" \
  -d '{
    "shop_id": 123456,
    "shop_domain": "ahmed-cod-test.myshopify.com",
    "customer": {
      "id": 987654,
      "email": "customer@example.com",
      "phone": "+923203737570"
    },
    "orders_requested": [1001, 1002]
  }'
```
*Expected Response:* `HTTP 200 OK` `{ "status": "ok", "message": "Customer data export processed" }`

---

### 2. Customer Redaction
```bash
curl -X POST "https://shopify-cod-whatsapp.onrender.com/api/webhooks/customers/redact" \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Hmac-Sha256: test_mock_signature" \
  -d '{
    "shop_id": 123456,
    "shop_domain": "ahmed-cod-test.myshopify.com",
    "customer": {
      "id": 987654,
      "email": "customer@example.com",
      "phone": "+923203737570"
    },
    "orders_to_redact": [1001, 1002]
  }'
```
*Expected Response:* `HTTP 200 OK` `{ "status": "ok", "message": "Customer data successfully redacted" }`

---

### 3. Shop Redaction
```bash
curl -X POST "https://shopify-cod-whatsapp.onrender.com/api/webhooks/shop/redact" \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Hmac-Sha256: test_mock_signature" \
  -d '{
    "shop_id": 123456,
    "shop_domain": "ahmed-cod-test.myshopify.com"
  }'
```
*Expected Response:* `HTTP 200 OK` `{ "status": "ok", "message": "Shop data purge scheduled" }`

---

### 4. Health Check
```bash
curl -X GET "https://shopify-cod-whatsapp.onrender.com/api/health"
```
*Expected Response:* `HTTP 200 OK` `{ "status": "ok", "version": "1.0.0", "timestamp": "..." }`

---

## 5. Review Screencast Video Script & Outline (3 Minutes)

Below is the script followed for our official Shopify Review Demo video:

| Timestamp | Screen Display | Voiceover / Script |
| :--- | :--- | :--- |
| **0:00 - 0:35** | Shopify Admin > Apps > SwiftCOD Dashboard | *"Hello Shopify Review Team! Today we are demonstrating SwiftCOD, an automated WhatsApp Cash on Delivery verification app designed to eliminate fake orders and reduce courier Return to Origin losses. As you can see on our Polaris dashboard, SwiftCOD is completely zero-config for the merchant. With one master toggle, the automated verification engine is active."* |
| **0:36 - 1:15** | Shopify Orders > Creating Draft/COD Order | *"Let's place a simulated COD order in our test store. We specify our test customer, shipping phone number, and select Cash on Delivery as the payment gateway. Upon completing the order, SwiftCOD captures the order in real time and standardizes the phone number."* |
| **1:16 - 1:55** | Smartphone Screen (WhatsApp App) | *"On the customer's smartphone, an interactive WhatsApp message arrives within 3 seconds showing the order summary and two native quick-reply buttons. Let's tap 'Confirm Order'. Immediately, the customer receives confirmation and the status updates."* |
| **1:56 - 2:30** | Shopify Order Detail Screen | *"Returning to Shopify Admin, we see that the order has been automatically stamped with the tag 'COD-Confirmed'. Warehouse staff now know this order is verified and safe to ship."* |
| **2:31 - 2:55** | Second Order with 'Cancel' Action | *"Now let's place a second order and tap 'Cancel Order'. Watch what happens in Shopify: the order is tagged 'COD-Cancelled', the order is automatically cancelled, payment marked voided, and line items are restocked immediately."* |
| **2:56 - 3:15** | Dashboard Financial Metrics & Privacy | *"Back in our dashboard, the analytics cards dynamically update to reflect the intercepted fake order and the courier shipping cash saved. All GDPR endpoints are active. Thank you for your review!"* |
