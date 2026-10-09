/**
 * Contato comercial da landing page.
 * Número com DDI e DDD, só dígitos (ex.: 5511999998888). Vazio esconde o botão do WhatsApp.
 */
export const WHATSAPP = "";

const MENSAGEM_WHATSAPP =
  "Olá! Conheci o Stagium e quero conversar sobre receber os dados do meu ERP em planilha.";

export const linkWhatsApp = () =>
  WHATSAPP ? `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(MENSAGEM_WHATSAPP)}` : "";
