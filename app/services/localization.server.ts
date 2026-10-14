import { parsePhoneNumber, type CountryCode } from "libphonenumber-js";

export type SupportedLocale = "en" | "ar" | "es";

export interface LocalizedOrderContext {
  locale: SupportedLocale;
  currency: string;
  countryCode: string;
  formattedAmount: string;
  normalizedPhone: string;
}

export interface OrderInputPayload {
  customerPhone?: string | null;
  customerLocale?: string | null;
  shippingCountryCode?: string | null;
  shippingAddressText?: string | null;
  totalPrice?: number | string | null;
  currency?: string | null;
  presentmentCurrency?: string | null;
}

const ARABIC_COUNTRIES = new Set([
  "SA", "AE", "KW", "QA", "BH", "OM", "EG", "JO", "LB", "MA", "DZ", "IQ", "YE", "TN", "LY", "SD"
]);

const SPANISH_COUNTRIES = new Set([
  "ES", "MX", "CO", "AR", "CL", "PE", "VE", "EC", "GT", "CU", "DO", "PA", "CR", "PR", "UY", "PY", "BO"
]);

/**
 * Resolves the primary language locale from country code and customer locale.
 * Prioritizes customer.locale if explicitly provided, otherwise falls back to shipping country.
 */
export function resolveLocale(countryCode?: string | null, customerLocale?: string | null): SupportedLocale {
  if (customerLocale) {
    const clean = customerLocale.toLowerCase().trim();
    if (clean.startsWith("ar")) return "ar";
    if (clean.startsWith("es")) return "es";
    if (clean.startsWith("en")) return "en";
  }

  if (countryCode) {
    const code = countryCode.toUpperCase().trim();
    if (ARABIC_COUNTRIES.has(code)) return "ar";
    if (SPANISH_COUNTRIES.has(code)) return "es";
  }

  return "en";
}

/**
 * Formats monetary amounts using Node native Intl.NumberFormat according to the resolved locale and currency.
 */
export function formatCurrency(amount: number | string, currency: string = "USD", locale: SupportedLocale = "en"): string {
  const numericAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  const safeAmount = isNaN(numericAmount) ? 0 : numericAmount;
  const safeCurrency = (currency || "USD").toUpperCase().trim();

  // Map our internal locale codes to full BCP 47 language tags for Intl
  const intlLocaleMap: Record<SupportedLocale, string> = {
    en: "en-US",
    ar: "ar-SA",
    es: "es-ES",
  };

  try {
    const formatter = new Intl.NumberFormat(intlLocaleMap[locale] || "en-US", {
      style: "currency",
      currency: safeCurrency,
      currencyDisplay: "symbol",
      minimumFractionDigits: safeCurrency === "PKR" || safeCurrency === "JPY" ? 0 : 2,
      maximumFractionDigits: 2,
    });
    return formatter.format(safeAmount);
  } catch {
    // Graceful fallback for non-ISO standard codes (e.g. custom store tokens)
    return `${safeCurrency} ${safeAmount.toFixed(2)}`;
  }
}

/**
 * Normalizes customer phone numbers to international E.164 standard using libphonenumber-js.
 */
export function normalizePhoneNumber(rawPhone: string, defaultCountry: string = "PK"): string {
  if (!rawPhone) return "";
  const cleaned = rawPhone.trim();
  const safeDefault = (defaultCountry || "PK").toUpperCase().slice(0, 2) as CountryCode;

  try {
    const parsed = parsePhoneNumber(cleaned, safeDefault);
    if (parsed && parsed.isValid()) {
      return parsed.format("E.164");
    }
  } catch {
    // If libphonenumber fails, apply sensible digits-only fallback
  }

  const digits = cleaned.replace(/\D/g, "");
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith("+")) return `+${digits.slice(1)}`;
  if (!cleaned.startsWith("+") && digits.length >= 10) return `+${digits}`;
  return cleaned;
}

/**
 * Comprehensive Order Resolution Engine combining country, locale, currency and phone formatting.
 */
export function resolveOrderContext(input: OrderInputPayload): LocalizedOrderContext {
  let countryCode = (input.shippingCountryCode || "").toUpperCase().trim();
  if (!countryCode && input.customerPhone) {
    try {
      const parsed = parsePhoneNumber(input.customerPhone);
      if (parsed?.country) {
        countryCode = parsed.country;
      }
    } catch {}
  }
  if (!countryCode) countryCode = "PK";

  const locale = resolveLocale(countryCode, input.customerLocale);
  const currency = (input.presentmentCurrency || input.currency || "PKR").toUpperCase().trim();
  const formattedAmount = formatCurrency(input.totalPrice ?? 0, currency, locale);
  const normalizedPhone = normalizePhoneNumber(input.customerPhone || "", countryCode);

  return {
    locale,
    currency,
    countryCode,
    formattedAmount,
    normalizedPhone,
  };
}

export interface LineItemSummary {
  title: string;
  quantity: number;
  price?: string | number;
  variantTitle?: string | null;
}

export interface TemplateStrings {
  greeting: (customerName?: string | null) => string;
  orderSummaryTitle: string;
  orderNumberLabel: string;
  itemsLabel: string;
  addressLabel: string;
  totalCodLabel: string;
  actionPrompt: string;
  buttons: {
    confirm: string;
    cancel: string;
    manage: string;
    editAddress: string;
    editItems: string;
    selectSlot: string;
  };
  timeSlots: {
    morning: string;
    evening: string;
  };
  prompts: {
    askAddress: string;
    addressUpdated: (address: string) => string;
    locationReceived: (lat: number, lng: number) => string;
    askItemEdit: string;
    itemsUpdated: (details: string) => string;
    askTimeSlot: string;
    timeSlotConfirmed: (slot: string) => string;
    orderConfirmed: (orderNumber: string) => string;
    orderCancelled: (orderNumber: string) => string;
  };
}

export const I18N_DICTIONARIES: Record<SupportedLocale, TemplateStrings> = {
  en: {
    greeting: (name) => `Hello ${name ? name : "Valued Customer"}! Thank you for ordering with us.`,
    orderSummaryTitle: "📦 Order Verification Required",
    orderNumberLabel: "Order Number:",
    itemsLabel: "Items Ordered:",
    addressLabel: "Delivery Address:",
    totalCodLabel: "Total Cash on Delivery to Pay:",
    actionPrompt: "Please confirm your Cash on Delivery order so our warehouse can pack and dispatch your parcel.",
    buttons: {
      confirm: "🟢 Confirm Order",
      cancel: "🔴 Cancel Order",
      manage: "⚙️ Modify Order",
      editAddress: "📍 Change Address",
      editItems: "🛍️ Change Items",
      selectSlot: "⏰ Delivery Slot",
    },
    timeSlots: {
      morning: "Morning (9:00 AM - 1:00 PM)",
      evening: "Evening (5:00 PM - 9:00 PM)",
    },
    prompts: {
      askAddress: "📍 Please reply with your updated delivery address (Street, House/Apt, City) or send your WhatsApp location pin 📍.",
      addressUpdated: (addr) => `✔ Delivery address updated to:\n"${addr}"\n\nPlease tap [Confirm Order] below to finalize your shipment.`,
      locationReceived: (lat, lng) => `📍 GPS Location coordinates (${lat.toFixed(4)}, ${lng.toFixed(4)}) recorded! Saved to your delivery courier notes.`,
      askItemEdit: "🛍️ Please reply with the item name, variant, or quantity you would like to modify.",
      itemsUpdated: (details) => `✔ Order items updated: ${details}`,
      askTimeSlot: "⏰ Please select your preferred courier delivery window:",
      timeSlotConfirmed: (slot) => `✔ Delivery time preference recorded: ${slot}. Our courier will aim for this window!`,
      orderConfirmed: (orderNum) => `✅ Order ${orderNum} is confirmed! Our warehouse is preparing your dispatch. Thank you!`,
      orderCancelled: (orderNum) => `❌ Order ${orderNum} has been cancelled per your request. The reserved stock has been restocked.`,
    },
  },
  ar: {
    greeting: (name) => `مرحبًا ${name ? name : "عميلنا العزيز"}! شكرًا لطلبك من متجرنا.`,
    orderSummaryTitle: "📦 تأكيد طلب الدفع عند الاستلام",
    orderNumberLabel: "رقم الطلب:",
    itemsLabel: "المنتجات المطلوبة:",
    addressLabel: "عنوان التوصيل:",
    totalCodLabel: "إجمالي المبلغ المطلوب دفعه عند الاستلام:",
    actionPrompt: "يرجى تأكيد طلبك للبدء في تجهيز الشحنة وإرسالها مع المندوب فورًا.",
    buttons: {
      confirm: "🟢 تأكيد الطلب",
      cancel: "🔴 إلغاء الطلب",
      manage: "⚙️ خيارات الطلب",
      editAddress: "📍 تعديل العنوان",
      editItems: "🛍️ تعديل المنتجات",
      selectSlot: "⏰ موعد التوصيل",
    },
    timeSlots: {
      morning: "الصباح (9:00 ص - 1:00 م)",
      evening: "المساء (5:00 م - 9:00 م)",
    },
    prompts: {
      askAddress: "📍 يرجى إرسال العنوان الجديد (الشارع، رقم المبنى/الشقة، المدينة) أو مشاركة موقعك عبر خرائط واتساب 📍.",
      addressUpdated: (addr) => `✔ تم تحديث عنوان التوصيل إلى:\n"${addr}"\n\nاضغط على [تأكيد الطلب] بالأسفل للمتابعة.`,
      locationReceived: (lat, lng) => `📍 تم استلام إحداثيات الموقع (${lat.toFixed(4)}, ${lng.toFixed(4)}) وحفظها لمندوب التوصيل بنجاح!`,
      askItemEdit: "🛍️ يرجى إرسال تفاصيل التعديل المطلوب (الكمية، المقاس، أو اللون).",
      itemsUpdated: (details) => `✔ تم تحديث المنتجات في الطلب: ${details}`,
      askTimeSlot: "⏰ يرجى اختيار موعد التوصيل المفضل لديك:",
      timeSlotConfirmed: (slot) => `✔ تم تسجيل موعد التوصيل المفضل: ${slot}. سنقوم بالتنسيق مع شركة الشحن!`,
      orderConfirmed: (orderNum) => `✅ تم تأكيد طلبك رقم ${orderNum} بنجاح! جاري التجهيز للشحن. شكرًا لك!`,
      orderCancelled: (orderNum) => `❌ تم إلغاء الطلب رقم ${orderNum} بناءً على رغبتك وتمت إعادة المنتجات للمخزون.`,
    },
  },
  es: {
    greeting: (name) => `¡Hola ${name ? name : "Estimado/a Cliente"}! Gracias por tu compra.`,
    orderSummaryTitle: "📦 Verificación de Pedido Contra Entrega",
    orderNumberLabel: "Número de Pedido:",
    itemsLabel: "Productos:",
    addressLabel: "Dirección de Entrega:",
    totalCodLabel: "Total Contra Entrega a Pagar:",
    actionPrompt: "Por favor confirma tu pedido para que nuestro equipo pueda prepararlo y enviarlo de inmediato.",
    buttons: {
      confirm: "🟢 Confirmar Pedido",
      cancel: "🔴 Cancelar Pedido",
      manage: "⚙️ Modificar Pedido",
      editAddress: "📍 Cambiar Dirección",
      editItems: "🛍️ Modificar Artículos",
      selectSlot: "⏰ Horario de Entrega",
    },
    timeSlots: {
      morning: "Mañana (9:00 - 13:00)",
      evening: "Tarde (17:00 - 21:00)",
    },
    prompts: {
      askAddress: "📍 Por favor envía tu nueva dirección de entrega o comparte tu ubicación en tiempo real de WhatsApp 📍.",
      addressUpdated: (addr) => `✔ Dirección de entrega actualizada a:\n"${addr}"\n\nToca [Confirmar Pedido] para procesar el envío.`,
      locationReceived: (lat, lng) => `📍 ¡Ubicación GPS (${lat.toFixed(4)}, ${lng.toFixed(4)}) registrada en tu pedido!`,
      askItemEdit: "🛍️ Por favor escribe los cambios que deseas en talla, color o cantidad.",
      itemsUpdated: (details) => `✔ Artículos del pedido actualizados: ${details}`,
      askTimeSlot: "⏰ Elige tu horario preferido de entrega:",
      timeSlotConfirmed: (slot) => `✔ Horario de entrega registrado: ${slot}.`,
      orderConfirmed: (orderNum) => `✅ ¡Pedido ${orderNum} confirmado! Ya estamos empaquetando tu paquete. ¡Gracias!`,
      orderCancelled: (orderNum) => `❌ Pedido ${orderNum} cancelado exitosamente y producto devuelto al inventario.`,
    },
  },
};

/**
 * Builds the complete rich order verification text body according to resolved locale.
 */
export function buildLocalizedOrderMessage(params: {
  locale: SupportedLocale;
  storeName: string;
  orderNumber: string;
  customerName?: string | null;
  items: LineItemSummary[];
  shippingAddress?: string | null;
  formattedAmount: string;
}): string {
  const dict = I18N_DICTIONARIES[params.locale];
  const itemsText = params.items.length > 0
    ? params.items.map((it) => `• ${it.title}${it.variantTitle ? ` (${it.variantTitle})` : ""} × ${it.quantity}`).join("\n")
    : "• Standard COD Order Items";

  const lines = [
    `*${params.storeName}*`,
    dict.greeting(params.customerName),
    "",
    `*${dict.orderSummaryTitle}*`,
    `${dict.orderNumberLabel} *${params.orderNumber}*`,
    "",
    `*${dict.itemsLabel}*`,
    itemsText,
    "",
    `*${dict.addressLabel}*`,
    params.shippingAddress || "Registered Delivery Address",
    "",
    `💰 *${dict.totalCodLabel}* *${params.formattedAmount}*`,
    "",
    dict.actionPrompt,
  ];

  return lines.join("\n");
}
