import test from "node:test";
import assert from "node:assert/strict";
import { synchronizeTableScroll } from "../frontend/src/features/workspace/useSynchronizedTableScroll.ts";

function table(max) {
  let left = 0;
  const listeners = new Set();
  return {
    get scrollLeft() {
      return left;
    },
    set scrollLeft(value) {
      left = Math.max(0, Math.min(max, value));
    },
    addEventListener: (_name, fn) => listeners.add(fn),
    removeEventListener: (_name, fn) => listeners.delete(fn),
    emit: () => {
      for (const fn of listeners) fn();
    },
  };
}
function clock() {
  let next = 0;
  const callbacks = new Map();
  return {
    request(fn) {
      callbacks.set(++next, fn);
      return next;
    },
    cancel(id) {
      callbacks.delete(id);
    },
    flush() {
      const pending = [...callbacks.values()];
      callbacks.clear();
      for (const fn of pending) fn();
    },
    get size() {
      return callbacks.size;
    },
  };
}
test("a pending partner resize cannot rewind a newer user scroll whose event has not arrived", () => {
  const primary = table(900),
    secondary = table(300),
    frames = clock();
  const close = synchronizeTableScroll(primary, secondary, frames);
  secondary.scrollLeft = 100;
  secondary.emit(); // Resize/clamp event queues a frame.
  primary.scrollLeft = 900; // Browser has not delivered this scroll event yet.
  frames.flush();
  assert.equal(primary.scrollLeft, 900);
  assert.equal(secondary.scrollLeft, 300);
  secondary.emit();
  primary.emit();
  assert.equal(frames.size, 0, "clamped mirror events must not echo back");
  close();
});
test("synchronized tables still follow both directions and remove pending work on disposal", () => {
  const primary = table(900),
    secondary = table(300),
    frames = clock();
  const close = synchronizeTableScroll(primary, secondary, frames);
  primary.scrollLeft = 200;
  primary.emit();
  frames.flush();
  assert.equal(secondary.scrollLeft, 200);
  secondary.scrollLeft = 150;
  secondary.emit();
  frames.flush();
  assert.equal(primary.scrollLeft, 150);
  primary.scrollLeft = 250;
  primary.emit();
  close();
  frames.flush();
  assert.equal(secondary.scrollLeft, 150);
});
