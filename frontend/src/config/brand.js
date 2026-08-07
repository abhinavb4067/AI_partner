/**
 * ✏️  BRAND CONFIGURATION — SINGLE SOURCE OF TRUTH
 *
 * Update this ONE file to rename the entire app.
 * Every page, navbar, footer, and title tag imports from here.
 */
const brand = {
  name: "Avoiga",              // ← Change this to your final brand name
  shortName: "Avoiga",            // ← Used in compact spaces (navbar logo)
  tagline: "Your perfect AI companion, always there for you.",
  description: "Connect with beautiful, intelligent AI companions. Chat, share photos, and build genuine connections — available 24/7.",
  email: "hello@avoiga.ectama.com",
  supportEmail: "support@avoiga.ectama.com",
  twitter: "@avoiga",
  instagram: "@avoiga",
  year: new Date().getFullYear(),

  // Color palette (CSS variables — also used inline)
  colors: {
    primary: "#e91e8c",       // hot pink
    primaryDark: "#c2185b",
    accent: "#9c27b0",        // purple
    gold: "#ffd700",
    bg: "#0a0a0f",
    bgCard: "#12121a",
    bgCardHover: "#1a1a26",
    text: "#f0f0f0",
    textMuted: "#888",
    border: "rgba(255,255,255,0.08)",
  },
};

export default brand;
