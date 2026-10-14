import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [
    { title: "Terms of Service | SwiftCOD: WhatsApp Verify" },
    {
      name: "description",
      content:
        "Terms of Service, Service Level Agreement (SLA), and acceptable use policy for SwiftCOD: WhatsApp Verify.",
    },
  ];
};

export default function TermsOfService() {
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
            <a href="/privacy" style={styles.navLink}>
              Privacy Policy
            </a>
            <a href="/terms" style={{ ...styles.navLink, fontWeight: "bold" }}>
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
            <h1 style={styles.title}>Terms of Service</h1>
            <p style={styles.subtitle}>
              <strong>Effective Date:</strong> January 1, 2026 &nbsp;|&nbsp;{" "}
              <strong>Last Updated:</strong> October 2026 &nbsp;|&nbsp;{" "}
              <strong>App ID:</strong> 431180972033
            </p>
          </div>

          <div style={styles.alert}>
            <strong>Terms Overview:</strong> By installing SwiftCOD on your Shopify store, you agree to utilize WhatsApp messaging exclusively for legitimate transactional order verification. All recurring subscription fees are processed via Shopify&#39;s official Billing API.
          </div>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>1. Acceptance of Terms</h2>
            <p style={styles.p}>
              By installing, accessing, or using the <strong>SwiftCOD: WhatsApp Verify</strong> application (&quot;SwiftCOD&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) from the Shopify App Store, you (&quot;Merchant&quot;, &quot;you&quot;, or &quot;your&quot;) agree to be bound by these Terms of Service and our <a href="/privacy" style={styles.link}>Privacy Policy</a>.
            </p>
            <p style={styles.p}>
              If you represent a business or commercial entity, you represent and warrant that you possess full legal authority to bind that entity to these Terms. If you do not agree, you must immediately uninstall and discontinue using the Application.
            </p>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>2. Description of Service</h2>
            <p style={styles.p}>SwiftCOD provides automated Cash on Delivery verification services for Shopify merchants by:</p>
            <ul style={styles.ul}>
              <li>Ingesting Shopify <code>orders/create</code> webhooks for qualifying COD payment orders.</li>
              <li>Normalizing telephone numbers into international E.164 standard.</li>
              <li>Transmitting interactive WhatsApp notifications with quick-reply buttons (<code>[Confirm]</code>, <code>[Cancel]</code>, <code>[Manage Order]</code>) via the Meta WhatsApp Cloud API.</li>
              <li>Updating Shopify Admin order tags (<code>COD-Confirmed</code>, <code>COD-Cancelled</code>, <code>COD-Expired</code>, <code>COD-Address-Modified</code>).</li>
              <li>Automatically cancelling orders and restoring inventory in Shopify when customers reject orders.</li>
            </ul>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>3. Acceptable Use Policy & WhatsApp Anti-Spam Rules</h2>
            <p style={styles.p}>
              You agree to comply with all applicable policies established by Meta Platforms, Inc., including the <strong>WhatsApp Business Messaging Policy</strong>:
            </p>
            <ul style={styles.ul}>
              <li>
                <strong>Transactional Use Only:</strong> SwiftCOD is strictly restricted to transactional order verification, address modification, and logistics updates.
              </li>
              <li>
                <strong>Prohibition of Marketing Broadcasts:</strong> You may <strong>never</strong> utilize SwiftCOD for unsolicited promotional spam, bulk marketing, political messaging, or prohibited goods.
              </li>
              <li>
                <strong>Customer Consent:</strong> You warrant that your storefront checkout informs customers that their telephone number will be used to deliver transactional WhatsApp verification updates.
              </li>
            </ul>
            <div style={styles.alertNotice}>
              <strong>Enforcement:</strong> Misuse of WhatsApp messaging for spam or promotional broadcasts will result in immediate termination of service and reporting to Meta Platforms.
            </div>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>4. Subscriptions, Fees & Billing</h2>
            <ul style={styles.ul}>
              <li>
                <strong>Official Shopify Billing API:</strong> All plan tiers (Starter $0/mo, Pro $29/mo, Enterprise $79/mo) are billed through Shopify&#39;s recurring application charges and appear directly on your standard Shopify merchant invoice.
              </li>
              <li>
                <strong>Plan Quotas:</strong> Starter tier accounts include up to 50 verified orders per month. Upgrading to Pro unlocks 1,000 monthly orders and multi-market editing.
              </li>
              <li>
                <strong>Instant Cancellation:</strong> You may cancel at any time simply by uninstalling SwiftCOD from your Shopify Admin. Uninstallation terminates all recurring billing immediately with zero penalty fees.
              </li>
            </ul>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>5. Service Level Agreement (SLA) & Dependencies</h2>
            <p style={styles.p}>
              SwiftCOD targets <strong>99.9% application uptime</strong> on managed cloud infrastructure. However, you acknowledge that delivery depends directly on:
            </p>
            <ul style={styles.ul}>
              <li>The uninterrupted operation of the Shopify Platform &amp; Admin API.</li>
              <li>Meta Platforms, Inc. and WhatsApp Cloud API message transit networks.</li>
              <li>Customer carrier reception, active WhatsApp installation, and battery/network conditions.</li>
            </ul>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>6. Courier & Commercial Outcomes Disclaimer</h2>
            <p style={styles.p}>
              SwiftCOD is an automated communications and order verification engine. While SwiftCOD drastically cuts Return-to-Origin (RTO) rates and eliminates ghost orders, <strong>SwiftCOD does not guarantee that a confirmed order will never be refused by a customer upon physical doorstep delivery</strong>. Courier shipping charges, return fees, and doorstep cash handling remain under the merchant&#39;s commercial purview.
            </p>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>7. Legal Contact & Support</h2>
            <p style={styles.p}>For legal inquiries, dispute resolution, or compliance questions:</p>
            <p style={styles.contactBox}>
              <strong>SwiftCOD Legal &amp; Compliance Team</strong><br />
              Email: <a href="mailto:legal@swiftcod.io" style={styles.link}>legal@swiftcod.io</a><br />
              Developer: CurrencyPanda Apps<br />
              Shopify App ID: <code>431180972033</code>
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
    backgroundColor: "#fef1f2",
    borderLeft: "4px solid #d82c0d",
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
