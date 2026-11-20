import { expect, test } from "vitest";
import { installChunkRecovery } from "./chunk-recovery";

function setup(start = 1_000_000) {
  let listener: ((event: Event) => void) | undefined;
  const stored = new Map<string, string>();
  const state = { now: start, reloads: 0 };
  installChunkRecovery({
    target: {
      addEventListener: (type: string, handler: (event: Event) => void) => {
        expect(type).toBe("vite:preloadError");
        listener = handler;
      },
    },
    storage: {
      getItem: (key) => stored.get(key) ?? null,
      setItem: (key, value) => void stored.set(key, value),
    },
    reload: () => void state.reloads++,
    now: () => state.now,
  });
  const fail = () => listener!(new Event("vite:preloadError"));
  return { fail, state };
}

test("reloads once when a page file from an older version is missing", () => {
  const { fail, state } = setup();
  fail();
  expect(state.reloads).toBe(1);
});

test("does not loop when the new version also fails right away", () => {
  const { fail, state } = setup();
  fail();
  state.now += 5_000;
  fail();
  expect(state.reloads).toBe(1);
});

test("recovers again after a later update", () => {
  const { fail, state } = setup();
  fail();
  state.now += 10 * 60_000;
  fail();
  expect(state.reloads).toBe(2);
});

test("still reloads when the browser blocks session storage", () => {
  let reloads = 0;
  let listener: ((event: Event) => void) | undefined;
  installChunkRecovery({
    target: { addEventListener: (_type, handler) => (listener = handler) },
    storage: {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    },
    reload: () => void reloads++,
    now: () => 0,
  });
  listener!(new Event("vite:preloadError"));
  expect(reloads).toBe(1);
});
