export function appUrl(path = "") {
  const base = new URL(import.meta.env.BASE_URL, window.location.origin);
  return new URL(path.replace(/^\//, ""), base).href;
}

export function recoveryIntent() {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const query = new URLSearchParams(window.location.search);
  return hash.get("type") === "recovery" || query.get("type") === "recovery" || sessionStorage.getItem("irma_password_recovery") === "true";
}

export function setRecoveryIntent(enabled) {
  if (enabled) sessionStorage.setItem("irma_password_recovery", "true");
  else sessionStorage.removeItem("irma_password_recovery");
}

// Capture errors before the auth library consumes the return URL.
const authHash = new URLSearchParams(window.location.hash.slice(1));
export const recoveryLinkError = authHash.get("error_description") || new URLSearchParams(window.location.search).get("error_description") || "";

export function passwordValidation(password, confirmation) {
  if (password.length < 8) return "Gebruik minimaal 8 tekens voor je nieuwe wachtwoord.";
  if (password !== confirmation) return "De nieuwe wachtwoorden komen niet overeen.";
  return "";
}
