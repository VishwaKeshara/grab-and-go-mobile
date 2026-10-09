export const supportConfig = {
  phone: "+94771234567",
  phoneDisplay: "077 123 4567",
  email: "pamudithajayasena@gmail.com",
  whatsapp: "94771234567",
  hours: "Daily • 7:00 AM – 9:00 PM",
  responseTime: "We reply within 24 hours",
  address: "Malabe Bazaar Hub",
  addressLine: "Kaduwela Road • Opposite SLIIT Junction",
} as const;

export type SupportConfig = typeof supportConfig;