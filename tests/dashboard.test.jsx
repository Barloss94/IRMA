// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { OrgContext } from "../src/hooks/useOrgAccess";
import DashboardPage from "../src/pages/DashboardPage";
const db = vi.hoisted(() => ({ error: null, calls: [] }));
vi.mock("../src/supabaseClient", () => ({ supabase: { from(table) {
  let head = false; let missing = false; const filters = [];
  const query = {
    select(_columns, options) { head = !!options?.head; return query; },
    eq(key, value) { filters.push([key, value]); return query; }, gte() { return query; }, order() { return query; }, limit() { return query; },
    is(key, value) { missing = key === "assignments" && value === null; return query; },
    then(resolve, reject) {
      db.calls.push({ table, filters, missing });
      const data = head ? null : [{ id: "game-1", home_team: "Club A", away_team: "Club B", starts_at: "2027-06-12T13:00:00Z", location: "Veld 1", assignments: [] }];
      const count = table === "memberships" ? 8 : table === "assignments" ? 2 : missing ? 3 : 5;
      return Promise.resolve({ data, count, error: db.error }).then(resolve, reject);
    },
  }; return query;
} } }));
function show(role) {
  return render(<OrgContext.Provider value={{ role, userId: "ref-1", name: "Testclub" }}><MemoryRouter initialEntries={["/org/club-1/dashboard"]}><Routes><Route path="/org/:orgId/dashboard" element={<DashboardPage />} /></Routes></MemoryRouter></OrgContext.Provider>);
}
beforeEach(() => { db.error = null; db.calls = []; });
afterEach(cleanup);
it("shows coordinator counts and matches needing an assignment", async () => {
  show("coordinator"); await screen.findByText("Nog aanstellen");
  expect(screen.getByText("Zonder scheidsrechter").parentElement.textContent).toContain("3");
  expect(screen.getByText("Gekoppelde personen").parentElement.textContent).toContain("8");
  expect(screen.getByText("Komende wedstrijden").parentElement.textContent).toContain("5");
  expect(db.calls.every((q) => q.filters.some(([key, value]) => key === "org_id" && value === "club-1"))).toBe(true);
});
it("shows a referee's next matches and omits coordinator controls", async () => {
  show("referee"); await screen.findByText("Club A – Club B");
  expect(screen.queryByText("Zonder scheidsrechter")).toBeNull();
  expect(screen.queryByText("Gekoppelde personen")).toBeNull();
  expect(db.calls.some((q) => q.filters.some(([key, value]) => key === "assignments.referee_user_id" && value === "ref-1"))).toBe(true);
});
it("does not display fabricated zero counts when a query fails", async () => {
  db.error = { message: "Geen toegang tot dashboard" }; show("coordinator");
  expect((await screen.findByRole("alert")).textContent).toBe("Geen toegang tot dashboard");
  expect(screen.queryByText("Komende wedstrijden")).toBeNull();
});
