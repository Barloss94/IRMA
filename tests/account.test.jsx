// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ProfilePage from "../src/pages/ProfilePage";
import { ForgotPasswordPage, ResetPasswordPage } from "../src/pages/AccountRecovery";
import App from "../src/App";

const mock = vi.hoisted(() => ({ upsert: vi.fn(), signIn: vi.fn(), update: vi.fn(), reset: vi.fn(), authCallback: null, session: { user: { id: "user-1", email: "me@test.invalid" } }, error: null }));
vi.mock("../src/supabaseClient", () => ({ supabase: {
  auth: {
    signInWithPassword: mock.signIn, updateUser: mock.update, resetPasswordForEmail: mock.reset,
    getSession: () => Promise.resolve({ data: { session: mock.session }, error: null }),
    onAuthStateChange(callback) { mock.authCallback = callback; return { data: { subscription: { unsubscribe() {} } } }; },
  },
  from(table) {
    const query = {
      select() { return query; }, eq() { return query; },
      maybeSingle() { return Promise.resolve({ data: table === "profiles" ? { full_name: "Oude naam" } : null, error: mock.error }); },
      upsert: mock.upsert,
    }; return query;
  },
} }));
const session = { user: { id: "user-1", email: "me@test.invalid" } };
function show(page) { return render(<MemoryRouter>{page}</MemoryRouter>); }
beforeEach(() => {
  vi.stubEnv("BASE_URL", "/IRMA/");
  mock.error = null; mock.session = session;
  for (const fn of [mock.upsert, mock.signIn, mock.update, mock.reset]) { fn.mockReset(); fn.mockResolvedValue({ data: {}, error: null }); }
  sessionStorage.clear();
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

it("saves the user's name to their own profile", async () => {
  const user = userEvent.setup(); show(<ProfilePage session={session} />);
  const input = await screen.findByLabelText("Naam");
  expect(input.value).toBe("Oude naam");
  await user.clear(input); await user.type(input, "Nieuwe naam");
  await user.click(screen.getByRole("button", { name: "Profiel opslaan" }));
  await screen.findByText("Je profiel is opgeslagen.");
  expect(mock.upsert).toHaveBeenCalledWith({ user_id: "user-1", full_name: "Nieuwe naam", email: "me@test.invalid" }, { onConflict: "user_id" });
});

it("rejects mismatched passwords before making auth requests", async () => {
  const user = userEvent.setup(); show(<ProfilePage session={session} />);
  await screen.findByLabelText("Naam");
  await user.type(screen.getByLabelText("Huidig wachtwoord"), "old-secret");
  await user.type(screen.getByLabelText("Nieuw wachtwoord"), "new-secret");
  await user.type(screen.getByLabelText("Herhaal nieuw wachtwoord"), "different-secret");
  await user.click(screen.getByRole("button", { name: "Wachtwoord wijzigen" }));
  expect((await screen.findByRole("alert")).textContent).toContain("niet overeen");
  expect(mock.signIn).not.toHaveBeenCalled(); expect(mock.update).not.toHaveBeenCalled();
});

it("checks the current password before changing it", async () => {
  const user = userEvent.setup(); show(<ProfilePage session={session} />);
  await screen.findByLabelText("Naam");
  await user.type(screen.getByLabelText("Huidig wachtwoord"), "wrong-secret");
  await user.type(screen.getByLabelText("Nieuw wachtwoord"), "new-secret");
  await user.type(screen.getByLabelText("Herhaal nieuw wachtwoord"), "new-secret");
  mock.signIn.mockResolvedValueOnce({ error: { code: "invalid_credentials" } });
  await user.click(screen.getByRole("button", { name: "Wachtwoord wijzigen" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Je huidige wachtwoord klopt niet.");
  expect(mock.update).not.toHaveBeenCalled();
  await user.clear(screen.getByLabelText("Huidig wachtwoord"));
  await user.type(screen.getByLabelText("Huidig wachtwoord"), "old-secret");
  await user.click(screen.getByRole("button", { name: "Wachtwoord wijzigen" }));
  await screen.findByText("Je wachtwoord is gewijzigd.");
  expect(mock.update).toHaveBeenCalledWith({ password: "new-secret" });
  expect(screen.getByLabelText("Nieuw wachtwoord").value).toBe("");
});

it("requests recovery with the IRMA return route and uses a neutral response", async () => {
  const user = userEvent.setup(); show(<ForgotPasswordPage />);
  await user.type(screen.getByLabelText("E-mailadres"), "me@test.invalid");
  await user.click(screen.getByRole("button", { name: "Herstelmail aanvragen" }));
  expect((await screen.findByRole("status")).textContent).toContain("Als dit e-mailadres bij een account hoort");
  expect(mock.reset).toHaveBeenCalledWith("me@test.invalid", { redirectTo: new URL("/IRMA/reset-password", window.location.origin).href });
});

it("does not offer password reset without a valid session", () => {
  show(<ResetPasswordPage session={null} onComplete={() => {}} />);
  expect(screen.getByRole("alert").textContent).toContain("ongeldig of verlopen");
  expect(screen.queryByLabelText("Nieuw wachtwoord")).toBeNull();
});

it("stores a new password using the session from the recovery link", async () => {
  const user = userEvent.setup(); const complete = vi.fn();
  show(<ResetPasswordPage session={session} onComplete={complete} />);
  await user.type(screen.getByLabelText("Nieuw wachtwoord"), "new-secret");
  await user.type(screen.getByLabelText("Herhaal nieuw wachtwoord"), "new-secret");
  await user.click(screen.getByRole("button", { name: "Wachtwoord opslaan" }));
  await screen.findByRole("heading", { name: "Wachtwoord ingesteld" });
  expect(mock.update).toHaveBeenCalledWith({ password: "new-secret" });
  expect(complete).toHaveBeenCalledTimes(1);
});

it("routes a PASSWORD_RECOVERY event to reset rather than the dashboard", async () => {
  mock.session = null;
  render(<MemoryRouter initialEntries={["/login"]}><App /></MemoryRouter>);
  await screen.findByRole("heading", { name: "Welkom bij IRMA" });
  const { act } = await import("@testing-library/react");
  await act(async () => { mock.authCallback("PASSWORD_RECOVERY", session); });
  await screen.findByLabelText("Nieuw wachtwoord");
  expect(sessionStorage.getItem("irma_password_recovery")).toBe("true");
});

it("keeps recovery mode across refreshes", async () => {
  sessionStorage.setItem("irma_password_recovery", "true");
  render(<MemoryRouter initialEntries={["/"]}><App /></MemoryRouter>);
  await screen.findByLabelText("Nieuw wachtwoord");
  expect(screen.queryByRole("heading", { name: "Dashboard" })).toBeNull();
});
