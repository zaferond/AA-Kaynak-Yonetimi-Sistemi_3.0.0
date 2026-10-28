// Pages run on a fixed browser clock while the in-process server reads the
// real one. Month rules (actuals only for finished months) must see the same
// month on both sides, so a check can shift the server clock for its duration.
const RealDate = globalThis.Date;
let offset = 0;
class ShiftedDate extends RealDate {
  constructor(...args) {
    if (args.length) super(...args);
    else super(RealDate.now() + offset);
  }
  static now() {
    return RealDate.now() + offset;
  }
}
globalThis.Date = ShiftedDate;

/** Moves the server clock to `date` (it keeps ticking); `null` restores it. */
export function setServerTime(date) {
  offset = date === null ? 0 : new RealDate(date).getTime() - RealDate.now();
}
