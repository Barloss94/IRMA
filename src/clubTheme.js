import clubColors from "./clubkleuren.txt?raw";

const colors = { zwart: "#171717", wit: "#ffffff", geel: "#f4cf19", rood: "#d71920", grijs: "#555b63" };
const normalizedName = (name) => (name || "").trim().toLocaleLowerCase("nl-NL").replace(/\s+/g, " ");
const palettes = Object.fromEntries(clubColors.trim().split(/\r?\n/).map((line) => {
  const [name, palette] = line.split(">");
  return [normalizedName(name), palette.trim().toLowerCase().split("/").map((color) => colors[color.trim()])];
}));
const rgb = (hex) => hex.slice(1).match(/../g).map((value) => parseInt(value, 16));
function mix(first, second, weight) {
  const a = rgb(first), b = rgb(second);
  return "#" + a.map((channel, i) => Math.round(channel * (1 - weight) + b[i] * weight).toString(16).padStart(2, "0")).join("");
}
function luminance(hex) {
  return rgb(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }).reduce((total, value, i) => total + value * [0.2126, 0.7152, 0.0722][i], 0);
}
export function contrast(first, second) {
  const a = luminance(first), b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
const foreground = (background) => contrast(background, "#ffffff") >= contrast(background, "#171717") ? "#ffffff" : "#171717";
function readableInk(color) {
  let ink = color;
  while (contrast(ink, "#ffffff") < 4.5) ink = mix(ink, "#000000", 0.12);
  return ink;
}

export function clubTheme(name) {
  const palette = palettes[normalizedName(name)];
  if (!palette) return {};
  const [primary, secondary] = palette;
  const sidebar = secondary === "#ffffff" ? primary : secondary;
  const sidebarText = foreground(sidebar);
  const active = sidebar === primary ? "#ffffff" : primary;
  const primaryText = foreground(primary);
  return {
    "--accent": primary,
    "--accent-hover": mix(primary, primaryText === "#ffffff" ? "#000000" : "#ffffff", 0.15),
    "--accent-fg": primaryText,
    "--accent-ink": readableInk(primary),
    "--accent-soft": mix(primary, "#ffffff", 0.90),
    "--accent-soft-hover": mix(primary, "#ffffff", 0.82),
    "--accent-border": mix(primary, "#ffffff", 0.60),
    "--focus": readableInk(primary),
    "--sidebar-bg": sidebar,
    "--sidebar-text": sidebarText,
    "--sidebar-muted": mix(sidebarText, sidebar, 0.25),
    "--sidebar-hover": mix(sidebar, sidebarText, 0.12),
    "--nav-active": active,
    "--nav-active-fg": foreground(active),
    "--text": "#292929",
    "--heading": "#171717",
  };
}
