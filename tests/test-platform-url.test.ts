import { afterEach, describe, expect, test } from "bun:test";
import { getApiBaseUrl, getApiUrl } from "../src/utils/platform";

const browserGlobals = globalThis as typeof globalThis & {
  window?: Window & typeof globalThis;
};

const originalWindow = browserGlobals.window;

afterEach(() => {
  browserGlobals.window = originalWindow;
});

describe("platform API URL selection", () => {
  test("keeps localhost relative for local dev", () => {
    browserGlobals.window = {
      location: { hostname: "localhost", origin: "http://localhost:5173" } as Location,
    } as Window & typeof globalThis;

    expect(getApiBaseUrl()).toBe("");
    expect(getApiUrl("/api/chat")).toBe("/api/chat");
  });

  test("uses the production origin outside localhost", () => {
    browserGlobals.window = {
      location: {
        hostname: "midicode.netlify.app",
        origin: "https://midicode.netlify.app",
      } as Location,
    } as Window & typeof globalThis;

    expect(getApiBaseUrl()).toBe("https://os.ryo.lu");
    expect(getApiUrl("/api/chat")).toBe("https://os.ryo.lu/api/chat");
  });
});
