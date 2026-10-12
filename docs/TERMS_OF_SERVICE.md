# Terms of Service for SwiftCOD (WhatsApp COD Verification)

**Effective Date:** January 1, 2026  
**Last Updated:** October 13, 2026  
**Application Name:** SwiftCOD: WhatsApp Verify ("SwiftCOD", "Application", "we", "us", or "our")

---

## 1. Acceptance of Terms

By installing, accessing, or using the SwiftCOD application from the Shopify App Store, you ("Merchant", "you", or "your") agree to be bound by these Terms of Service ("Terms") and our [Privacy Policy](file:///e:/cod-whatsapp-verify/docs/PRIVACY_POLICY.md). If you are agreeing on behalf of a business entity, you represent and warrant that you possess the requisite authority to bind that entity to these Terms.

If you do not agree to these Terms, you must immediately uninstall and discontinue use of the Application.

---

## 2. Description of Service

SwiftCOD provides automated Cash on Delivery (COD) order verification services for Shopify merchants. The service operates by:
1. Ingesting Shopify `orders/create` webhook notifications for qualifying COD and manual payment orders.
2. Normalizing the customer's phone number into valid international E.164 format.
3. Transmitting interactive WhatsApp notifications with quick-reply action buttons ([Confirm Order] / [Cancel Order]) via the Meta WhatsApp Cloud API.
4. Listening for customer decision webhooks and updating Shopify order tags (`COD-Confirmed`, `COD-Cancelled`, `COD-Expired`) and executing auto-cancellation mutations when configured.
5. Providing an analytics dashboard displaying verified orders, intercepted fake orders, and estimated Return-to-Origin (RTO) shipping cash saved.

---

## 3. Merchant Obligations & Acceptable Use Policy (AUP)

### A. Customer Notice & Consent
You warrant that:
* Your storefront checkout contains appropriate notices informing customers that their contact telephone numbers will be utilized to deliver transactional order confirmation updates via WhatsApp.
* You will not submit fraudulent, fabricated, or non-consensual phone numbers to the service.

### B. Meta WhatsApp Business Policy Compliance
You agree to comply with all applicable policies established by Meta Platforms, Inc., including the **WhatsApp Business Messaging Policy**:
* SwiftCOD is strictly restricted to **transactional order confirmation and logistics updates**.
* You may **not** utilize SwiftCOD for unsolicited marketing broadcasts, bulk promotional spam, political campaigning, or prohibited commercial content.
* Violation of Meta's messaging policies may result in immediate suspension of your WhatsApp dispatch capabilities without prior notice.

### C. Legal & Regulatory Compliance
You are solely responsible for ensuring your utilization of WhatsApp transactional messaging complies with all local telecommunications and consumer protection regulations (such as the Telephone Consumer Protection Act (TCPA) in the United States, PECR in the UK, and local TRA/PTA regulations in Asian and Middle Eastern jurisdictions).

---

## 4. Subscriptions, Fees & Billing

### A. Shopify Billing Integration
All fees, plan upgrades, and recurring subscription charges are billed exclusively through Shopify's official Billing API. Charges appear directly on your regular Shopify monthly invoice.

### B. Tier Quotas & Overages
* Each plan level includes a specified monthly quota of verified order dispatches.
* If your store exceeds its allotted monthly quota, additional verifications may either be billed at the designated per-order overage rate or paused until the commencement of the subsequent billing cycle, depending on your configured billing settings.

### C. Cancellation & Refunds
You may cancel your subscription at any time by uninstalling the Application from your Shopify Admin. Uninstallation immediately terminates future billing cycles. Because fees are processed through Shopify, refund requests are evaluated in accordance with Shopify App Store refund guidelines.

---

## 5. Service Level Agreement (SLA) & Third-Party Dependencies

SwiftCOD strives for **99.9% service availability**. However, you acknowledge that the Application depends directly on the uninterrupted availability of:
1. **The Shopify Platform & Admin API:** For webhook delivery and order status updates.
2. **Meta Platforms & the WhatsApp Cloud API:** For international message transit and quick-reply delivery.
3. **Telecommunications Carriers & Customer Device Settings:** End-customer carrier reception, active WhatsApp installation, and battery/network conditions.

SwiftCOD shall not be held liable for delayed or undelivered messages caused by outages, latency, or rate-limiting enforced by Shopify or Meta Platforms.

---

## 6. Courier & Commercial Outcomes Disclaimer

SwiftCOD is an automated communications and order verification tool. While SwiftCOD drastically reduces Return-to-Origin (RTO) rates and filters out fraudulent orders, **SwiftCOD does not guarantee that confirmed orders will never be refused by customers at doorstep delivery**. 

You acknowledge that courier delivery performance, doorstep customer availability, and package refusal are outside of SwiftCOD's operational control. SwiftCOD disclaims all liability for courier shipping charges, restocking costs, or cash-handling discrepancies incurred by the Merchant.

---

## 7. Intellectual Property

SwiftCOD, including its proprietary codebase, state machine architectures, user interface designs, and trademarks, is the intellectual property of SwiftCOD and its licensors. You are granted a revocable, non-exclusive, non-transferable license to utilize the Application solely within your authorized Shopify store instance.

---

## 8. Limitation of Liability

To the maximum extent permitted by applicable law, in no event shall SwiftCOD, its officers, employees, or partners be liable for:
* Any indirect, incidental, punitive, special, or consequential damages.
* Loss of profits, lost revenue, lost inventory, data loss, or business interruption.
* Total aggregate liability arising out of or related to these Terms exceeding the total amount paid by you to SwiftCOD during the three (3) months immediately preceding the event giving rise to liability.

---

## 9. Termination

* **By Merchant:** You may terminate these Terms at any time by uninstalling SwiftCOD from your Shopify Admin.
* **By SwiftCOD:** We reserve the right to suspend or terminate your access if you violate these Terms, engage in spamming, or misuse the Meta WhatsApp API.
* **Effect of Termination:** Upon uninstallation, all active message triggers cease immediately. Stored shop configurations and session credentials will be purged in accordance with our [Privacy Policy](file:///e:/cod-whatsapp-verify/docs/PRIVACY_POLICY.md).

---

## 10. Governing Law & Dispute Resolution

These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which SwiftCOD operates, without regard to conflict of law principles. Any legal disputes arising under these Terms shall be resolved through confidential binding arbitration.

---

## 11. Contact Us

For support, billing inquiries, or legal notifications:
* **Support:** `support@swiftcod.io`
* **Legal:** `legal@swiftcod.io`
* **Website:** `https://swiftcod.io`
