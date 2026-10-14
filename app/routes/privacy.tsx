import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [
    { title: "Privacy Policy | SwiftCOD: WhatsApp Verify" },
    {
      name: "description",
      content:
        "Privacy Policy and data processing terms for SwiftCOD WhatsApp Cash on Delivery verification on Shopify.",
    },
  ];
};

export default function PrivacyPolicy() {
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.brand}>
            <span style={styles.brandIcon}>🟢</span>
            <span style={styles.brandName}>SwiftCOD</span>
            <span style={styles.badge}>Shopify App Store Certified</span>
          </div>
          <nav style={styles.nav}>
            <a href="/privacy" style={{ ...styles.navLink, fontWeight: "bold" }}>
              Privacy Policy
            </a>
            <a href="/terms" style={styles.navLink}>
              Terms of Service
            </a>
            <a href="/api/health" style={styles.navLink}>
              API Health
            </a>
          </nav>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.card}>
          <div style={styles.metaHeader}>
            <h1 style={styles.title}>Privacy Policy</h1>
            <p style={styles.subtitle}>
              <strong>Effective Date:</strong> January 1, 2026 &nbsp;|&nbsp;{" "}
              <strong>Last Updated:</strong> October 2026 &nbsp;|&nbsp;{" "}
              <strong>App ID:</strong> 431180972033
            </p>
          </div>

          <div style={styles.alert}>
            <strong>Privacy Summary:</strong> SwiftCOD processes customer telephone numbers and order metadata strictly to deliver 1-click transactional WhatsApp order confirmation buttons on behalf of Shopify merchants. We never store credit cards, never sell user data, and fully honor all GDPR and CCPA privacy rights.
          </div>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>1. Introduction & Overview</h2>
            <p style={styles.p}>
              <strong>SwiftCOD: WhatsApp Verify</strong> (&quot;SwiftCOD&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) provides an automated Cash on Delivery (COD) order verification application for merchants operating on the Shopify e-commerce platform.
            </p>
            <p style={styles.p}>
              This Privacy Policy explains how SwiftCOD collects, processes, stores, and protects personal data when a merchant installs the Application or when an end-customer places a Cash on Delivery order with an enrolled merchant. Under the European General Data Protection Regulation (GDPR) and the California Consumer Privacy Act (CCPA/CPRA), SwiftCOD operates as a <strong>Data Processor</strong> acting on the instructions of the Shopify merchant (the <strong>Data Controller</strong>).
            </p>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>2. Personal Data We Collect</h2>
            <p style={styles.p}>
              We adhere strictly to the principle of data minimization and only collect data essential for order verification:
            </p>
            <ul style={styles.ul}>
              <li>
                <strong>Customer Telephone Number:</strong> Ingested via Shopify <code>orders/create</code> webhook to format into international E.164 standard and dispatch the transactional WhatsApp message.
              </li>
              <li>
                <strong>Customer Name:</strong> Utilized exclusively to personalize the WhatsApp verification message greeting.
              </li>
              <li>
                <strong>Order Metadata:</strong> Order Number, Line Item Titles, Order Total Amount, Presentment Currency, and Shipping Address.
              </li>
              <li>
                <strong>Verification Status:</strong> Buyer button interactions (<code>CONFIRMED</code>, <code>CANCELLED</code>, <code>AWAITING_ADDRESS_INPUT</code>), timestamp, and Meta WhatsApp message delivery IDs.
              </li>
            </ul>
            <div style={styles.alertNotice}>
              <strong>Notice on Financial PII:</strong> SwiftCOD <strong>never</strong> collects, processes, or stores payment card numbers, bank credentials, CVVs, or login passwords.
            </div>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>3. Purpose & Legal Basis for Processing</h2>
            <p style={styles.p}>We process personal information under the following legal bases pursuant to Article 6 of the GDPR:</p>
            <ul style={styles.ul}>
              <li>
                <strong>Performance of a Contract (Art. 6(1)(b) GDPR):</strong> Contacting the customer to verify order intent and delivery address prior to fulfillment.
              </li>
              <li>
                <strong>Legitimate Interests (Art. 6(1)(f) GDPR):</strong> Enabling merchants to prevent fraudulent orders, combat Return-to-Origin (RTO) abuse, and protect shipping logistics from unauthorized or fictitious orders.
              </li>
              <li>
                <strong>Legal Compliance (Art. 6(1)(c) GDPR):</strong> Complying with statutory accounting and platform compliance obligations.
              </li>
            </ul>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>4. Sub-processors & Infrastructure Providers</h2>
            <p style={styles.p}>
              Personal data is transferred exclusively to vetted sub-processors under strict Data Protection Agreements:
            </p>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Sub-processor</th>
                  <th style={styles.th}>Purpose</th>
                  <th style={styles.th}>Security Standard</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={styles.td}><strong>Meta Platforms, Inc.</strong></td>
                  <td style={styles.td}>WhatsApp Cloud API message transit</td>
                  <td style={styles.td}>SOC 2, ISO 27001, TLS Encryption</td>
                </tr>
                <tr>
                  <td style={styles.td}><strong>Supabase, Inc. (AWS)</strong></td>
                  <td style={styles.td}>Encrypted PostgreSQL database hosting</td>
                  <td style={styles.td}>SOC 2 Type II, AES-256 at rest</td>
                </tr>
                <tr>
                  <td style={styles.td}><strong>Shopify, Inc.</strong></td>
                  <td style={styles.td}>E-commerce platform & webhook delivery</td>
                  <td style={styles.td}>PCI-DSS Level 1, SOC 2 Type II</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>5. Data Retention & Erasure Policy</h2>
            <p style={styles.p}>
              * <strong>Active Verification Records:</strong> Retained for a maximum of <strong>90 days</strong> post-creation to allow merchants to calculate RTO savings, audit tags, and review delivery metrics. Records older than 90 days are permanently purged.
            </p>
            <p style={styles.p}>
              * <strong>App Uninstallation:</strong> When a merchant uninstalls the Application, session tokens are revoked immediately, and all stored shop verification data is completely wiped within <strong>48 hours</strong> pursuant to Shopify compliance rules.
            </p>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>6. Mandatory Shopify GDPR Compliance Endpoints</h2>
            <p style={styles.p}>
              SwiftCOD provides automated 24/7 webhooks for Shopify’s mandatory privacy compliance directives:
            </p>
            <ul style={styles.ul}>
              <li>
                <code>/api/webhooks/customers-data-request</code>: Generates an export of all verification data for the specified customer.
              </li>
              <li>
                <code>/api/webhooks/customers-redact</code>: Automatically scrubs and redacts customer names and telephone numbers.
              </li>
              <li>
                <code>/api/webhooks/shop-redact</code>: Automatically purges all shop database records 48 hours following app uninstallation.
              </li>
            </ul>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>7. Your Rights & Contact Details</h2>
            <p style={styles.p}>
              Customers and merchants hold the right to access, rectify, or request permanent deletion of their data at any time. To exercise your rights, please contact our Data Protection Officer:
            </p>
            <p style={styles.contactBox}>
              <strong>SwiftCOD Data Privacy Team</strong><br />
              Email: <a href="mailto:privacy@swiftcod.io" style={styles.link}>privacy@swiftcod.io</a><br />
              Developer: CurrencyPanda Apps<br />
              Application ID: <code>431180972033</code>
            </p>
          </section>
        </div>
      </main>

      <footer style={styles.footer}>
        <div style={styles.footerInner}>
          <p>© 2026 SwiftCOD: WhatsApp Verify. Built for Shopify merchants worldwide.</p>
          <div style={styles.footerLinks}>
            <a href="/privacy" style={styles.footerLink}>Privacy Policy</a>
            <a href="/terms" style={styles.footerLink}>Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    backgroundColor: "#f6f6f7",
    color: "#202223",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    lineHeight: "1.6",
  },
  header: {
    backgroundColor: "#ffffff",
    borderBottom: "1px solid #e1e3e5",
    padding: "16px 24px",
  },
  headerInner: {
    maxWidth: "960px",
    margin: "0 auto",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  brandIcon: {
    fontSize: "22px",
  },
  brandName: {
    fontSize: "18px",
    fontWeight: "700",
    color: "#008060",
  },
  badge: {
    fontSize: "12px",
    fontWeight: "600",
    backgroundColor: "#e3f1df",
    color: "#108043",
    padding: "3px 8px",
    borderRadius: "12px",
  },
  nav: {
    display: "flex",
    gap: "20px",
  },
  navLink: {
    color: "#5c5f62",
    textDecoration: "none",
    fontSize: "14px",
  },
  main: {
    flex: 1,
    padding: "40px 20px",
  },
  card: {
    maxWidth: "960px",
    margin: "0 auto",
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    padding: "48px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  metaHeader: {
    borderBottom: "1px solid #e1e3e5",
    paddingBottom: "24px",
    marginBottom: "24px",
  },
  title: {
    fontSize: "32px",
    fontWeight: "700",
    color: "#202223",
    margin: "0 0 8px 0",
  },
  subtitle: {
    fontSize: "14px",
    color: "#6d7175",
    margin: 0,
  },
  alert: {
    backgroundColor: "#f1f8f5",
    borderLeft: "4px solid #008060",
    padding: "16px",
    borderRadius: "4px",
    fontSize: "14px",
    marginBottom: "32px",
  },
  alertNotice: {
    backgroundColor: "#fbf7ed",
    borderLeft: "4px solid #b98900",
    padding: "12px 16px",
    borderRadius: "4px",
    fontSize: "14px",
    marginTop: "16px",
  },
  section: {
    marginBottom: "36px",
  },
  sectionTitle: {
    fontSize: "20px",
    fontWeight: "600",
    color: "#202223",
    margin: "0 0 12px 0",
  },
  p: {
    fontSize: "15px",
    color: "#4a4d50",
    margin: "0 0 12px 0",
  },
  ul: {
    margin: "0 0 16px 0",
    paddingLeft: "24px",
    color: "#4a4d50",
    fontSize: "15px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: "16px",
    fontSize: "14px",
  },
  th: {
    textAlign: "left",
    padding: "12px",
    backgroundColor: "#f7f8f9",
    borderBottom: "2px solid #e1e3e5",
    color: "#202223",
  },
  td: {
    padding: "12px",
    borderBottom: "1px solid #e1e3e5",
    color: "#4a4d50",
  },
  contactBox: {
    backgroundColor: "#f7f8f9",
    padding: "16px",
    borderRadius: "8px",
    fontSize: "14px",
    color: "#202223",
    lineHeight: "1.8",
  },
  link: {
    color: "#008060",
    textDecoration: "underline",
  },
  footer: {
    backgroundColor: "#ffffff",
    borderTop: "1px solid #e1e3e5",
    padding: "24px 20px",
    fontSize: "13px",
    color: "#6d7175",
  },
  footerInner: {
    maxWidth: "960px",
    margin: "0 auto",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerLinks: {
    display: "flex",
    gap: "16px",
  },
  footerLink: {
    color: "#6d7175",
    textDecoration: "none",
  },
};
