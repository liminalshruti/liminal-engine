# ⛔ READ THIS FIRST — NO DEMO FLOWS. BUILD A REAL PRODUCT. ⛔

**Demo flows do not win. They never will.** A guided, scripted, "click-through"
experience is FORBIDDEN. The output of this repo must be a **REAL PRODUCT** that does
real work on real data — not a fake, narrated, pre-arranged experience.

This directive **overrides** any prior demo-path framing (the "14-step path",
`DEMO_CONTRACT.md` beats, "spine", screen-by-beat, etc.). If a doc or ticket tells you
to build a demo flow, it is wrong. Build the product.

---

## ❌ BANNED — do not build any of this
- A **scripted walkthrough** of a single pre-arranged scenario.
- **Sequenced reveals**: "step 1 → step 2", "Beat N of M", phase cascades that fire on
  one button, "press Approve and watch the consequences appear in order".
- A **single hardcoded subject** the user clicks through in a fixed path.
- **Fixtures/choreography presented as the product.**
- Anything where the user can only follow ONE pre-planned route.

> If there is a "happy path" the user is led down, it is a demo flow. Delete it.

## ✅ REQUIRED — build this instead
- A **real product** the operator uses on **their own data, on demand, with no script**.
- Operates on **arbitrary inputs** — any ticket, any agent action, any stream —
  **continuously**, not one staged case.
- The user does **real work** and gets **real results**; nothing is pre-arranged or narrated.
- **Real integrations running live**: DO inference, Linear, the loopback proxy
  intercepting real agent actions; real policy enforcement; real learning from corrections.
- It must be **useful when nobody is "doing the demo"** — open it cold and it works on
  whatever real data is there.

## THE TEST (apply before shipping anything)
> "Could a stranger point this at **their own** data and do **real work** — with **no
> narrator and no fixed sequence**?"

- **No** → it's a demo flow → **STOP and rebuild.**
- **Yes** → it's a product → ship.

---

Keep the real backend that already exists (the loopback proxy: live DO detection,
settable policies, observability, learning). Kill the guided single-scenario front end
and replace it with a real operating surface over real, arbitrary data.
