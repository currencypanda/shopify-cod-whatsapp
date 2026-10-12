import prisma from "../app/db.server";

async function verify() {
  const shop = "ahmed-cod-test.myshopify.com";
  const config = await prisma.shopConfig.upsert({
    where: { shop },
    create: {
      shop,
      defaultCountryCode: "92",
      currencySymbol: "PKR",
      autoCancelOnCustomerCancel: true,
      autoExpiryHours: 24,
      autoTagConfirmed: "COD-Confirmed",
      autoTagCancelled: "COD-Cancelled",
      autoTagExpired: "COD-Expired",
      whatsappTemplateName: "cod_order_verification",
    },
    update: {
      defaultCountryCode: "92",
      currencySymbol: "PKR",
      autoCancelOnCustomerCancel: true,
      autoExpiryHours: 24,
      autoTagConfirmed: "COD-Confirmed",
      autoTagCancelled: "COD-Cancelled",
      autoTagExpired: "COD-Expired",
    },
  });

  console.log("=== ShopConfig in Database ===");
  console.log(`Shop:                       ${config.shop}`);
  console.log(`Default Country Code:       ${config.defaultCountryCode}`);
  console.log(`Currency Symbol:            ${config.currencySymbol}`);
  console.log(`Auto Cancel on Customer:    ${config.autoCancelOnCustomerCancel}`);
  console.log(`Auto Expiry Hours:          ${config.autoExpiryHours}`);
  console.log(`Auto Tag Confirmed:         ${config.autoTagConfirmed}`);
  console.log(`Auto Tag Cancelled:         ${config.autoTagCancelled}`);
  console.log(`Auto Tag Expired:           ${config.autoTagExpired}`);
  console.log(`WhatsApp Phone Number ID:   ${config.whatsappPhoneNumberId || "(not set)"}`);
  console.log(`WhatsApp Access Token:      ${config.whatsappAccessToken ? "Present" : "(not set)"}`);
}

verify()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
