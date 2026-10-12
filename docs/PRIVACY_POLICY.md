# Privacy Policy for SwiftCOD (WhatsApp COD Verification)

**Effective Date:** January 1, 2026  
**Last Updated:** October 13, 2026  
**Application Name:** SwiftCOD: WhatsApp Verify ("SwiftCOD", "Application", "we", "us", or "our")

---

## 1. Introduction & Overview

SwiftCOD provides automated Cash on Delivery (COD) order verification services via the WhatsApp Cloud API for merchants operating on the Shopify e-commerce platform. 

This Privacy Policy explains how SwiftCOD collects, processes, stores, and protects personal data when a merchant installs the Application or when a merchant's end-customer places an order subject to verification.

SwiftCOD operates primarily as a **Data Processor** on behalf of the Shopify merchant (the **Data Controller**), under the provisions of the European General Data Protection Regulation (GDPR), the California Consumer Privacy Act (CCPA/CPRA), and relevant international data privacy laws.

---

## 2. Personal Data We Collect

To execute automated WhatsApp order verification, SwiftCOD collects and processes only the minimum data necessary:

### A. Customer Data (Collected via Shopify Webhooks & Admin API)
* **Phone Number:** Customer shipping or billing phone number (used exclusively to deliver the transactional verification message via WhatsApp).
* **Customer Name:** First and last name (used to personalize the greeting in the verification notification).
* **Order Metadata:** Shopify Order ID, order number, line items, order total amount, and currency.
* **Verification Status & History:** Message delivery timestamps, quick-reply responses (`CONFIRMED`, `CANCELLED`, `EXPIRED`), and Meta WhatsApp message delivery IDs.

> [!NOTE]
> SwiftCOD **never** collects, processes, or stores payment card information, credit/debit card numbers, CVVs, bank account credentials, or passwords.

### B. Merchant Account Data
* **Shopify Domain:** `your-store.myshopify.com` domain identifier.
* **Shopify OAuth Offline Access Token:** Stored in encrypted session storage to query and update order tags.
* **Merchant Preferences:** Auto-cancellation toggles, expiry window thresholds, RTO estimated cost metrics, and custom tags.

---

## 3. Purpose & Legal Basis for Data Processing

We process personal information under the following legal bases pursuant to Article 6 of the GDPR:

1. **Performance of a Contract (Art. 6(1)(b) GDPR):** Processing customer contact numbers and order details is necessary to verify customer intent and perform the transaction requested by the customer.
2. **Legitimate Interests (Art. 6(1)(f) GDPR):** Enabling merchants to prevent fraudulent orders, combat Return-to-Origin (RTO) abuse, and protect shipping logistics from unauthorized or fictitious orders.
3. **Legal Compliance (Art. 6(1)(c) GDPR):** Adhering to statutory data preservation, tax, and auditing requirements where applicable.

---

## 4. Sub-processors & Third-Party Service Providers

SwiftCOD shares data strictly with vetted sub-processors essential for infrastructure and message delivery:

| Sub-processor | Purpose | Location | Security Standard |
| :--- | :--- | :--- | :--- |
| **Meta Platforms, Inc. / Meta Cloud API** | WhatsApp transactional message delivery | Ireland / USA | SOC 2, ISO 27001, End-to-End & TLS Transit Encryption |
| **Supabase, Inc. (AWS)** | Encrypted cloud PostgreSQL database hosting | Tokyo, Japan / USA | SOC 2 Type II, AES-256 at rest, TLS 1.3 in transit |
| **Shopify, Inc.** | E-commerce platform & webhook delivery | Canada / Global | Level 1 PCI DSS, SOC 2 Type II |

We do not sell, rent, monetize, or share personal data with data brokers, ad networks, or marketing platforms.

---

## 5. Data Retention & Erasure Schedule

* **Active Verification Orders:** Customer phone numbers and order IDs are stored in our secure database for a maximum of **90 days** post-verification to allow merchants to review analytics, resolve dispute claims, and calculate RTO savings.
* **Automated Expiry & Archiving:** Records older than 90 days are automatically scrubbed or permanently aggregated into anonymous analytics.
* **App Uninstallation:** When a merchant uninstalls SwiftCOD, our platform receives Shopify's `app/uninstalled` webhook. All merchant configuration and active session credentials are deleted or deactivated immediately, with permanent shop data erasure completed within **48 hours**.

---

## 6. Mandatory Shopify Privacy Compliance Endpoints

SwiftCOD implements full support for Shopify’s mandatory compliance webhooks:

1. **Customer Data Request Endpoint (`/api/webhooks/customers/data_request`):**
   When a customer requests an export of their stored personal data through Shopify, SwiftCOD extracts all verification records matching the customer’s phone number and order history and provides them in structured JSON format within statutory deadlines.
2. **Customer Redaction Endpoint (`/api/webhooks/customers/redact`):**
   When a customer exercises their right to erasure under GDPR or CCPA, SwiftCOD permanently redacts or deletes the customer's phone number, name, and personal identifiers from all database tables within 48 hours.
3. **Shop Redaction Endpoint (`/api/webhooks/shop/redact`):**
   Forty-eight (48) hours after a merchant uninstalls the Application, Shopify triggers this endpoint. SwiftCOD completely purges all stored order verification logs, shop configurations, and session records associated with that store domain.

---

## 7. Customer & Merchant Rights (GDPR & CCPA/CPRA)

Individuals located in the European Economic Area (EEA), the United Kingdom, California, and other jurisdictions possess specific statutory rights:

* **Right of Access:** Request copies of personal data held about you.
* **Right to Rectification:** Request correction of inaccurate or incomplete contact numbers.
* **Right to Erasure ("Right to be Forgotten"):** Request permanent deletion of verification records.
* **Right to Restrict Processing:** Limit how we process your personal data.
* **Right to Non-Discrimination:** We do not discriminate against any user for exercising their privacy rights.
* **Right to Object:** Object to processing based on legitimate interests.

To exercise any of these rights, contact our Data Protection Team at **privacy@swiftcod.io** or submit a request directly through your Shopify store merchant.

---

## 8. Data Security Measures

We implement industry-grade technical and organizational safeguards:
* **Encryption in Transit:** All communications between Shopify, our web service, Meta WhatsApp servers, and merchants use TLS 1.3 encryption.
* **Encryption at Rest:** All database tables and database backups stored on Supabase are encrypted using AES-256.
* **Minimalist Privilege Architecture:** Database credentials and API secrets are isolated in production environment variables with zero plaintext logging.

---

## 9. Changes to this Policy

We may update this Privacy Policy periodically to reflect changes in our legal obligations, platform features, or third-party APIs. When material updates occur, we will notify merchants via an in-app banner or via email.

---

## 10. Contact Information

If you have questions, concerns, or requests regarding this Privacy Policy, please contact:

* **Data Protection Officer (DPO):** Data Compliance Team
* **Email:** `privacy@swiftcod.io`
* **Support Portal:** `https://swiftcod.io/support`
