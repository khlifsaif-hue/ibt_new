export const locales = ["en", "ar", "fr"] as const;
export type Locale = (typeof locales)[number];

export const translations = {
  en: {
    helpCenterPlaceholder: "Help Center — ask how to use the system",
    ask: "Ask",
    notifications: "Notifications",
    systemOnline: "System online",
    allGatewaysConnected: "All gateways connected",
    smartCareUser: "SmartCare User",
    profile: "My Profile",
    permissions: "My Permissions",
    signOut: "Sign out",
    language: "Language",
    ar: "AR",
    fr: "FR",
    enLabel: "EN",
  },
  ar: {
    helpCenterPlaceholder: "مركز المساعدة — اسأل عن كيفية استخدام النظام",
    ask: "اسأل",
    notifications: "الإشعارات",
    systemOnline: "النظام متصل",
    allGatewaysConnected: "جميع البوابات متصلة",
    smartCareUser: "مستخدم SmartCare",
    profile: "ملفي الشخصي",
    permissions: "صلاحياتي",
    signOut: "تسجيل الخروج",
    language: "اللغة",
    ar: "AR",
    fr: "FR",
    enLabel: "EN",
  },
  fr: {
    helpCenterPlaceholder: "Centre d’aide — demandez comment utiliser le système",
    ask: "Demander",
    notifications: "Notifications",
    systemOnline: "Système en ligne",
    allGatewaysConnected: "Toutes les passerelles sont connectées",
    smartCareUser: "Utilisateur SmartCare",
    profile: "Mon profil",
    permissions: "Mes permissions",
    signOut: "Se déconnecter",
    language: "Langue",
    ar: "AR",
    fr: "FR",
    enLabel: "EN",
  },
} as const;

export const defaultLocale: Locale = "en";

export function getLocaleFromValue(value: string | null | undefined): Locale {
  if (value === "ar" || value === "fr") return value;
  return defaultLocale;
}
