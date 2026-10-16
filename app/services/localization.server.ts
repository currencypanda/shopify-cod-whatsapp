import { parsePhoneNumber, type CountryCode } from "libphonenumber-js";

export type SupportedLocale = "en" | "ar" | "es" | "ur";
export type BotTone = "friendly" | "urgent" | "formal";

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
    if (clean.startsWith("ur")) return "ur";
    if (clean.startsWith("ar")) return "ar";
    if (clean.startsWith("es")) return "es";
    if (clean.startsWith("en")) return "en";
  }

  if (countryCode) {
    const code = countryCode.toUpperCase().trim();
    if (code === "PK") return "ur";
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

  // Map internal locale codes to full BCP 47 language tags for Intl
  const intlLocaleMap: Record<SupportedLocale, string> = {
    en: "en-US",
    ar: "ar-SA",
    es: "es-ES",
    ur: "en-PK",
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
export function normalizePhoneNumber(rawPhone: string, defaultCountry: string = "PK"): string | null {
  if (!rawPhone || typeof rawPhone !== "string") return null;
  const cleaned = rawPhone.trim();
  if (!cleaned) return null;
  const safeDefault = (defaultCountry || "PK").toUpperCase().slice(0, 2) as CountryCode;

  let e164: string | null = null;
  try {
    const parsed = parsePhoneNumber(cleaned, safeDefault);
    if (parsed && parsed.isValid()) {
      e164 = parsed.format("E.164");
    }
  } catch {
    // If libphonenumber fails, apply sensible digits-only fallback
  }

  if (!e164) {
    const digits = cleaned.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) return null;
    if (digits.startsWith("00") && digits.length >= 10) e164 = `+${digits.slice(2)}`;
    else if (cleaned.startsWith("+") && digits.length >= 8) e164 = `+${digits}`;
    else if (digits.startsWith("0") && safeDefault === "PK" && digits.length === 11) e164 = `+92${digits.slice(1)}`;
    else if (digits.startsWith("0") && safeDefault === "AE" && digits.length === 10) e164 = `+971${digits.slice(1)}`;
    else if (digits.startsWith("0") && safeDefault === "SA" && digits.length === 10) e164 = `+966${digits.slice(1)}`;
    else if (digits.length >= 10) e164 = `+${digits}`;
  }

  if (!e164 || !/^\+[1-9]\d{7,14}$/.test(e164)) return null;

  // Enforce mobile-only validation for WhatsApp routing (reject landlines like 042-35761999)
  if (e164.startsWith("+92") && !/^\+923\d{9}$/.test(e164)) return null;
  if (e164.startsWith("+971") && !/^\+9715\d{8}$/.test(e164)) return null;
  if (e164.startsWith("+966") && !/^\+9665\d{8}$/.test(e164)) return null;

  return e164;
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
  const currency = (input.presentmentCurrency || input.currency || (locale === "ur" ? "PKR" : "USD")).toUpperCase().trim();
  const formattedAmount = formatCurrency(input.totalPrice ?? 0, currency, locale);
  const normalizedPhone = normalizePhoneNumber(input.customerPhone || "", countryCode) || "";

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

export interface ToneVariation {
  greeting: (customerName?: string | null) => string;
  orderSummaryTitle: string;
  actionPrompt: string;
}

export interface TemplateStrings {
  greeting: (customerName?: string | null) => string;
  orderSummaryTitle: string;
  orderNumberLabel: string;
  itemsLabel: string;
  addressLabel: string;
  totalCodLabel: string;
  actionPrompt: string;
  tones: Record<BotTone, ToneVariation>;
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
    greeting: (name) => `Hello ${name ? name : "Valued Customer"}! 😊 Thank you so much for ordering with us.`,
    orderSummaryTitle: "📦 Order Verification Required",
    orderNumberLabel: "Order Number:",
    itemsLabel: "Items Ordered:",
    addressLabel: "Delivery Address:",
    totalCodLabel: "Total Cash on Delivery to Pay:",
    actionPrompt: "Please confirm your Cash on Delivery order below so our team can prepare and dispatch your parcel right away!",
    tones: {
      friendly: {
        greeting: (name) => `Hello ${name ? name : "Valued Customer"}! 😊 Thank you so much for ordering with us.`,
        orderSummaryTitle: "📦 Order Verification Required",
        actionPrompt: "Please confirm your Cash on Delivery order below so our team can prepare and dispatch your parcel right away!",
      },
      urgent: {
        greeting: (name) => `Attention ${name ? name : "Customer"}: Action required on your recent order.`,
        orderSummaryTitle: "⚡ Urgent: Verify Your COD Order",
        actionPrompt: "⚠️ Please confirm your Cash on Delivery order immediately. Reserved stock will be released if not confirmed promptly.",
      },
      formal: {
        greeting: (name) => `Dear ${name ? name : "Customer"}, thank you for your order.`,
        orderSummaryTitle: "📋 Order Verification Notice",
        actionPrompt: "Kindly review and verify your Cash on Delivery order details below to authorize shipment.",
      },
    },
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
  ur: {
    greeting: (name) => `Assalam-o-Alaikum ${name ? name : "Janab"}! 😊 Humare store se shopping karne ka bohat shukriya.`,
    orderSummaryTitle: "📦 Order Tasdeeq (Verification)",
    orderNumberLabel: "Order Number:",
    itemsLabel: "Ordered Saman:",
    addressLabel: "Delivery Pata (Address):",
    totalCodLabel: "Adaigi Cash on Delivery (Total COD):",
    actionPrompt: "Meharbani farma kar apna Cash on Delivery order confirm karein taake hum foran aap ka parcel dispatch kar sakein!",
    tones: {
      friendly: {
        greeting: (name) => `Assalam-o-Alaikum ${name ? name : "Janab"}! 😊 Humare store se shopping karne ka bohat shukriya.`,
        orderSummaryTitle: "📦 Order Tasdeeq (Verification)",
        actionPrompt: "Meharbani farma kar apna Cash on Delivery order confirm karein taake hum foran aap ka parcel dispatch kar sakein!",
      },
      urgent: {
        greeting: (name) => `Zaroori Ittila ${name ? name : "Janab"}: Aap ke order ki tasdeeq foran darkar hai.`,
        orderSummaryTitle: "⚡ Fouri Tawajjah: COD Order Verification",
        actionPrompt: "⚠️ Baraye meharbani apna order foran confirm karein taake stock cancel hone se bach sake aur waqt par dispatch ho sake.",
      },
      formal: {
        greeting: (name) => `Mohtaram ${name ? name : "Grahak"}, aap ke order ke liye shukriya.`,
        orderSummaryTitle: "📋 Ba-zariya Order Tasdeeq Nama",
        actionPrompt: "Bara-e-meharbani apne Cash on Delivery order ki tasdeeq karein taake shipment ka marhala mukammal kiya ja sake.",
      },
    },
    buttons: {
      confirm: "🟢 Order Confirm Karein",
      cancel: "🔴 Order Cancel Karein",
      manage: "⚙️ Order Tabdeel Karein",
      editAddress: "📍 Address Badlein",
      editItems: "🛍️ Items Badlein",
      selectSlot: "⏰ Delivery Time",
    },
    timeSlots: {
      morning: "Subah (9:00 AM - 1:00 PM)",
      evening: "Shaam (5:00 PM - 9:00 PM)",
    },
    prompts: {
      askAddress: "📍 Baraye meharbani apna naya delivery address (Gali, Makaan/Flat number, Sheher) likh kar bhejein ya WhatsApp location pin share karein 📍.",
      addressUpdated: (addr) => `✔ Delivery address update ho gaya hai:\n"${addr}"\n\nAb dispatch ke liye neechay [Order Confirm Karein] par tap karein.`,
      locationReceived: (lat, lng) => `📍 GPS Location (${lat.toFixed(4)}, ${lng.toFixed(4)}) record ho gayi hai! Courier rider ke delivery note me shaamil kar di gayi hai.`,
      askItemEdit: "🛍️ Baraye meharbani item ka naam, size ya nayi quantity likh kar send karein.",
      itemsUpdated: (details) => `✔ Order items update ho gaye hain: ${details}`,
      askTimeSlot: "⏰ Baraye meharbani apni pasand ka delivery waqt chuniye:",
      timeSlotConfirmed: (slot) => `✔ Delivery waqt save ho gaya hai: ${slot}. Courier rider is waqt pohanchne ki koshish karega!`,
      orderConfirmed: (orderNum) => `✅ Order ${orderNum} confirm ho chuka hai! Hamara warehouse aap ka parcel pack kar raha hai. Shukriya!`,
      orderCancelled: (orderNum) => `❌ Order ${orderNum} aap ki darkhwast par cancel kar diya gaya hai. Reserved stock wapas inventory me shamil kar diya gaya hai.`,
    },
  },
  ar: {
    greeting: (name) => `مرحبًا ${name ? name : "عميلنا العزيز"}! 😊 يسعدنا ويسرنا تسوقك معنا.`,
    orderSummaryTitle: "📦 تأكيد طلب الدفع عند الاستلام",
    orderNumberLabel: "رقم الطلب:",
    itemsLabel: "المنتجات المطلوبة:",
    addressLabel: "عنوان التوصيل:",
    totalCodLabel: "إجمالي المبلغ المطلوب دفعه عند الاستلام:",
    actionPrompt: "يرجى تأكيد طلبك بالأسفل حتى نتمكن من تجهيز الشحنة وإرسالها فورًا إلى عنوانك!",
    tones: {
      friendly: {
        greeting: (name) => `مرحبًا ${name ? name : "عميلنا العزيز"}! 😊 يسعدنا ويسرنا تسوقك معنا.`,
        orderSummaryTitle: "📦 تأكيد طلب الدفع عند الاستلام",
        actionPrompt: "يرجى تأكيد طلبك بالأسفل حتى نتمكن من تجهيز الشحنة وإرسالها فورًا إلى عنوانك!",
      },
      urgent: {
        greeting: (name) => `تنبيه هام ${name ? name : "عميلنا العزيز"}: يُرجى اتخاذ إجراء بشأن طلبك.`,
        orderSummaryTitle: "⚡ عاجل: تأكيد طلب الدفع عند الاستلام",
        actionPrompt: "⚠️ يرجى تأكيد طلبك في أقرب وقت لتفادي إلغاء حجز المنتجات وإرسال الشحنة في الموعد.",
      },
      formal: {
        greeting: (name) => `السيد/ة ${name ? name : "العميل المحترم"}، شكرًا لتسوقكم معنا.`,
        orderSummaryTitle: "📋 إشعار تأكيد الطلب",
        actionPrompt: "نرجو منكم التكرم بمراجعة وتأكيد تفاصيل طلب الدفع عند الاستلام للبدء بإجراءات الشحن.",
      },
    },
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
    greeting: (name) => `¡Hola ${name ? name : "Estimado/a Cliente"}! 😊 Muchas gracias por comprar con nosotros.`,
    orderSummaryTitle: "📦 Verificación de Pedido Contra Entrega",
    orderNumberLabel: "Número de Pedido:",
    itemsLabel: "Productos:",
    addressLabel: "Dirección de Entrega:",
    totalCodLabel: "Total Contra Entrega a Pagar:",
    actionPrompt: "Por favor confirma tu pedido contra entrega a continuación para que podamos preparar y despachar tu paquete de inmediato.",
    tones: {
      friendly: {
        greeting: (name) => `¡Hola ${name ? name : "Estimado/a Cliente"}! 😊 Muchas gracias por comprar con nosotros.`,
        orderSummaryTitle: "📦 Verificación de Pedido Contra Entrega",
        actionPrompt: "Por favor confirma tu pedido contra entrega a continuación para que podamos preparar y despachar tu paquete de inmediato.",
      },
      urgent: {
        greeting: (name) => `Atención ${name ? name : "Cliente"}: Se requiere confirmación para tu pedido.`,
        orderSummaryTitle: "⚡ Urgente: Verifica tu Pedido Contra Entrega",
        actionPrompt: "⚠️ Por favor confirma tu pedido lo antes posible para garantizar la reserva de tu producto y evitar la cancelación.",
      },
      formal: {
        greeting: (name) => `Estimado/a ${name ? name : "Cliente"}, gracias por su compra.`,
        orderSummaryTitle: "📋 Notificación de Verificación de Pedido",
        actionPrompt: "Le solicitamos cordialmente revisar y confirmar los detalles de su pedido contra entrega para autorizar el despacho.",
      },
    },
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
 * Builds the complete rich order verification text body according to resolved locale and tone.
 */
export function buildLocalizedOrderMessage(params: {
  locale: SupportedLocale;
  storeName: string;
  orderNumber: string;
  customerName?: string | null;
  items: LineItemSummary[];
  shippingAddress?: string | null;
  formattedAmount: string;
  tone?: BotTone;
}): string {
  const dict = I18N_DICTIONARIES[params.locale] || I18N_DICTIONARIES.en;
  const tone = params.tone || "friendly";
  const toneDict = dict.tones?.[tone] || dict.tones?.friendly || {
    greeting: dict.greeting,
    orderSummaryTitle: dict.orderSummaryTitle,
    actionPrompt: dict.actionPrompt,
  };

  const itemsText = params.items.length > 0
    ? params.items.map((it) => `• ${it.title}${it.variantTitle ? ` (${it.variantTitle})` : ""} × ${it.quantity}`).join("\n")
    : "• Standard COD Order Items";

  const lines = [
    `*${params.storeName}*`,
    toneDict.greeting(params.customerName),
    "",
    `*${toneDict.orderSummaryTitle}*`,
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
    toneDict.actionPrompt,
  ];

  return lines.join("\n");
}
