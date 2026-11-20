import { expect, test } from "vitest";
import {
  businessDate,
  pickNextTicket,
  shortCustomerName,
  type Priority,
} from "./queue.js";

const ratios = { ratioNormal: 2, ratioPreferential: 1 };

function ticket(id: string, priority: Priority, index: number) {
  return { id, priority, queuedAt: new Date(index) };
}

test("interleaves two normal calls with one preferential and prioritizes 80+ within the preferential block", () => {
  let remaining = [
    ticket("P1", "PREFERENTIAL", 0),
    ticket("N3", "NORMAL", 4),
    ticket("N1", "NORMAL", 1),
    ticket("N2", "NORMAL", 2),
    ticket("80", "PRIORITY80", 3),
    ticket("N4", "NORMAL", 5),
  ];
  const order: string[] = [];
  let turn = 0;
  while (remaining.length) {
    const next = pickNextTicket(remaining, ratios, turn);
    expect(next.ticket).toBeDefined();
    order.push(next.ticket!.id);
    remaining = remaining.filter(({ id }) => id !== next.ticket!.id);
    turn = next.nextTurn;
  }
  expect(order).toEqual(["N1", "N2", "80", "N3", "N4", "P1"]);
});

test("falls back when either type is empty and preserves its turn", () => {
  expect(
    pickNextTicket([ticket("P1", "PREFERENTIAL", 0)], ratios, 0),
  ).toMatchObject({ ticket: { id: "P1" }, nextTurn: 0 });
  expect(pickNextTicket([ticket("N1", "NORMAL", 0)], ratios, 2)).toMatchObject({
    ticket: { id: "N1" },
    nextTurn: 2,
  });
  expect(pickNextTicket([], ratios, 1)).toEqual({
    ticket: undefined,
    nextTurn: 1,
  });
});

test("uses arrival to choose the block across services and prioritizes 80+ within the preferential block", () => {
  const priority80 = ticket("80", "PRIORITY80", 3);
  const preferential = ticket("P", "PREFERENTIAL", 1);
  const normal = ticket("N", "NORMAL", 2);
  expect(
    pickNextTicket([normal, priority80, preferential], "arrival").ticket,
  ).toBe(priority80);

  const olderNormal = ticket("N0", "NORMAL", 0);
  expect(
    pickNextTicket([priority80, olderNormal, preferential], "arrival").ticket,
  ).toBe(olderNormal);
});

test("calculates a tenant-local operational day and a custom opening hour", () => {
  expect(
    businessDate(
      new Date("2026-11-19T02:59:59Z"),
      "America/Sao_Paulo",
      "00:00",
    ),
  ).toBe("2026-11-18");
  expect(
    businessDate(
      new Date("2026-11-19T03:00:00Z"),
      "America/Sao_Paulo",
      "00:00",
    ),
  ).toBe("2026-11-19");
  expect(
    businessDate(
      new Date("2026-01-01T07:00:00Z"),
      "America/Sao_Paulo",
      "05:00",
    ),
  ).toBe("2025-12-31");
  expect(
    businessDate(
      new Date("2026-01-01T08:00:00Z"),
      "America/Sao_Paulo",
      "05:00",
    ),
  ).toBe("2026-01-01");
});

test("abbreviates names for the call display", () => {
  expect(shortCustomerName("Maria Souza Lima")).toBe("Maria S.");
  expect(shortCustomerName("João")).toBe("João");
  expect(shortCustomerName(null)).toBeUndefined();
});
