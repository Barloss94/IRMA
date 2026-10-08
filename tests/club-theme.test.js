import { expect, it } from "vitest";
import { clubTheme, contrast } from "../src/clubTheme";

it.each([
  ["Always Forward", "#171717", "#171717"],
  ["Blokkers", "#f4cf19", "#171717"],
  ["Westfriezen", "#f4cf19", "#f4cf19"],
  ["Hollandia", "#d71920", "#171717"],
  ["Zwaluwen", "#d71920", "#555b63"],
  ["HSV Sport", "#f4cf19", "#171717"],
])("applies %s club colours with readable controls", (name, primary, sidebar) => {
  const theme = clubTheme(name);
  expect(theme["--accent"]).toBe(primary);
  expect(theme["--sidebar-bg"]).toBe(sidebar);
  for (const [background, text] of [["--accent", "--accent-fg"], ["--accent-hover", "--accent-fg"], ["--sidebar-bg", "--sidebar-text"], ["--nav-active", "--nav-active-fg"]]) {
    expect(contrast(theme[background], theme[text])).toBeGreaterThanOrEqual(4.5);
  }
  expect(contrast(theme["--accent-ink"], "#ffffff")).toBeGreaterThanOrEqual(4.5);
});

it("matches names regardless of case or extra spaces", () => {
  expect(clubTheme("  ALWAYS   forward  ")).toEqual(clubTheme("Always Forward"));
});

it("falls back to IRMA styling for an unknown club and after leaving a club", () => {
  expect(clubTheme("Test vereniging")).toEqual({});
  expect(clubTheme(null)).toEqual({});
  expect(clubTheme("Hollandia")).not.toEqual(clubTheme("Always Forward"));
});
