// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import MatchesPage from "../src/pages/MatchesPage";
import { OrgContext } from "../src/hooks/useOrgAccess";
import { dutchDateTime } from "../src/matchDates";

const db = vi.hoisted(() => ({ matches: [], assignments: [], fail: false, next: 1 }));
vi.mock("../src/supabaseClient", () => ({ supabase: { from(table) {
  const filters = []; let mode = "read"; let payload;
  const query = {
    select() { return query; }, eq(key, value) { filters.push([key, value]); return query; }, order() { return query; },
    insert(value) { mode = "insert"; payload = value; return query; },
    update(value) { mode = "update"; payload = value; return query; },
    delete() { mode = "delete"; return query; },
    then(resolve, reject) {
      return Promise.resolve().then(() => {
        if (db.fail) return { data: null, error: { message: "Opslaan geweigerd" } };
        if (table === "memberships") return { data: [{ user_id: "ref-1", role: "referee", profiles: { full_name: "Test Scheidsrechter", email: "ref@test.invalid" } }], error: null };
        const items = db[table]; const selected = items.filter((item) => filters.every(([key, value]) => item[key] === value));
        let data;
        if (mode === "insert") { data = [{ ...payload, id: `item-${db.next++}` }]; items.push(...data); }
        else if (mode === "update") { selected.forEach((item) => Object.assign(item, payload)); data = selected; }
        else if (mode === "delete") { data = selected; db[table] = items.filter((item) => !selected.includes(item)); if (table === "matches") db.assignments = db.assignments.filter((a) => !selected.some((m) => m.id === a.match_id)); }
        else data = selected.map((item) => table === "matches" ? { ...item, assignments: db.assignments.filter((a) => a.match_id === item.id) } : { ...item, matches: db.matches.find((m) => m.id === item.match_id) });
        return { data, error: null };
      }).then(resolve, reject);
    },
  }; return query;
} } }));
function show(role = "coordinator", personal = false) {
  return render(<OrgContext.Provider value={{ userId: role === "referee" ? "ref-1" : "coord-1", role }}><MemoryRouter initialEntries={["/org/club-1/matches"]}><Routes><Route path="/org/:orgId/matches" element={<MatchesPage personal={personal} />} /></Routes></MemoryRouter></OrgContext.Provider>);
}
beforeEach(() => { db.matches = []; db.assignments = []; db.next = 1; db.fail = false; vi.spyOn(window, "confirm").mockReturnValue(true); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("Dutch match times", () => {
  it("converts summer and winter independently of device timezone", () => {
    expect(dutchDateTime("2027-06-12", "15:00")).toBe("2027-06-12T13:00:00.000Z");
    expect(dutchDateTime("2027-01-12", "15:00")).toBe("2027-01-12T14:00:00.000Z");
  });
  it("rejects nonexistent spring clock-change times", () => {
    expect(() => dutchDateTime("2027-03-28", "02:30")).toThrow("zomertijd");
  });
});

it("creates, edits, assigns, unassigns and deletes a match", async () => {
  const user = userEvent.setup(); show();
  await user.click(screen.getByRole("button", { name: "+ Wedstrijd toevoegen" }));
  await user.type(screen.getByLabelText("Thuisteam"), "Club A");
  await user.type(screen.getByLabelText("Uitteam"), "Club B");
  await user.type(screen.getByLabelText("Datum"), "2027-06-12");
  await user.type(screen.getByLabelText("Tijd (Nederland)"), "15:00");
  await user.type(screen.getByLabelText("Locatie / veld"), "Veld 1");
  await user.click(screen.getByRole("button", { name: "Opslaan" }));
  await screen.findByRole("heading", { name: "Club A – Club B" });
  expect(db.matches[0].starts_at).toBe("2027-06-12T13:00:00.000Z");
  expect(db.matches[0].org_id).toBe("club-1");
  await user.click(screen.getByRole("button", { name: "Wijzigen" }));
  await user.clear(screen.getByLabelText("Locatie / veld"));
  await user.type(screen.getByLabelText("Locatie / veld"), "Veld 2");
  await user.click(screen.getByRole("button", { name: "Opslaan" }));
  await screen.findByText("Veld 2");
  await user.click(screen.getByRole("button", { name: "Scheidsrechter aanstellen" }));
  await user.selectOptions(screen.getByLabelText("Scheidsrechter kiezen"), "ref-1");
  await user.click(screen.getByRole("button", { name: "Aanstellen", exact: true }));
  await screen.findByText("Test Scheidsrechter");
  expect(db.assignments[0].referee_user_id).toBe("ref-1");
  await user.click(screen.getByRole("button", { name: "Aanstelling verwijderen" }));
  await waitFor(() => expect(db.assignments).toHaveLength(0));
  await user.click(screen.getByRole("button", { name: "Verwijderen", exact: true }));
  await screen.findByRole("heading", { name: "Geen wedstrijden gevonden" });
  expect(db.matches).toHaveLength(0);
});

it("shows only personal assignments and hides management from referees", async () => {
  db.matches = [ { id: "game-1", org_id: "club-1", home_team: "Eigen", away_team: "Wedstrijd", starts_at: "2027-01-01T15:00:00Z" }, { id: "game-2", org_id: "club-1", home_team: "Andere", away_team: "Wedstrijd", starts_at: "2027-01-02T15:00:00Z" } ];
  db.assignments = [{ id: "a1", org_id: "club-1", match_id: "game-1", referee_user_id: "ref-1" }, { id: "a2", org_id: "club-1", match_id: "game-2", referee_user_id: "ref-2" }];
  show("referee", true);
  await screen.findByRole("heading", { name: "Eigen – Wedstrijd" });
  expect(screen.queryByRole("heading", { name: "Andere – Wedstrijd" })).toBeNull();
  expect(screen.queryByRole("button", { name: "+ Wedstrijd toevoegen" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Wijzigen" })).toBeNull();
});

it("preserves form and reports an unsuccessful write", async () => {
  const user = userEvent.setup(); show();
  await user.click(screen.getByRole("button", { name: "+ Wedstrijd toevoegen" }));
  await user.type(screen.getByLabelText("Thuisteam"), "A");
  await user.type(screen.getByLabelText("Uitteam"), "B");
  await user.type(screen.getByLabelText("Datum"), "2027-06-12");
  await user.type(screen.getByLabelText("Tijd (Nederland)"), "15:00");
  db.fail = true;
  await user.click(screen.getByRole("button", { name: "Opslaan" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Opslaan geweigerd");
  expect(screen.getByLabelText("Thuisteam").value).toBe("A");
  expect(db.matches).toHaveLength(0);
});
