# How to Record the Demo Video

> Hackathon: Liminal Engine Governance Hack 2026
> Task: LIM-1197 — Record demo walkthrough (14-step Acme false-green scenario)

## Quick Start

The demo video should capture the full 14-step walkthrough of the Liminal Engine governance loop running through the Acme $1.2M false-green scenario. The video should be under 3 minutes and show all must-not-cut items from `DEMO_CONTRACT.md`.

### Step 1: Start the dev server

```bash
cd apps/desktop-demo
pnpm dev
```

The app will start on `http://localhost:5173` (or similar).

### Step 2: Open the app in your browser

Navigate to the local dev URL. You should see:
- A left sidebar with 14 numbered beats (steps)
- A main stage showing beat #1 (Initialize workspace)
- Navigation buttons (Back / Next)

### Step 3: Start recording

Choose your recording tool:

#### **macOS (QuickTime Player — built-in, free)**

1. Open **QuickTime Player** (Spotlight: Cmd+Space → type "QuickTime")
2. **File** → **New Screen Recording**
3. Click the red record button
4. Select the window/screen showing the demo app
5. Click **Start Recording**

#### **macOS/Linux/Windows (OBS Studio — free, cross-platform, recommended)**

1. Download [OBS Studio](https://obsproject.com/)
2. Add a **Display Capture** or **Window Capture** source
3. Select the browser window with the demo app
4. Click **Start Recording** (or Cmd+Shift+R)
5. When done, click **Stop Recording**

#### **Windows (Built-in: Win+G → Game Bar)**

1. Press **Win+G** to open Game Bar
2. Click the **Capture** button or press **Win+Alt+R**
3. A recording indicator will appear
4. Stop recording with **Win+Alt+R** again

### Step 4: Step through the 14 beats

Once recording is active:

1. **Beat #1 (Initialize)** — shown on screen, take ~5 seconds
2. Click **Next →** button to advance to beat #2
3. **Beat #2 (Business Goal)** — read the goal text, ~5 seconds
4. Continue clicking Next for each beat:
   - #3: Agent output (false green)
   - #4: Lost EU data-residency requirement
   - #5: GovernanceCase surfaces
   - #6: Operator clicks Approve + Enforce
   - #7: Status flips On Track → At Risk
   - #8: Simulated Linear workstream
   - #9: Required owners (Product/Security/Engineering)
   - #10: Blocked customer update
   - #11: AuditEvent recorded
   - #12: EvalCase generated
   - #13: Second pass improves
   - #14: Eval table shows Fail → Pass

**Timing:** Each beat should take ~10–15 seconds. Total runtime should be **under 3 minutes** (target: 2–2.5 minutes).

### Step 5: Stop recording and save

1. Stop the recording tool (Cmd+Ctrl+Space → Stop, or OBS Stop Recording, etc.)
2. Save the file as: **`demos/recordings/acme-governance-demo.mp4`**

(Alternative names: `acme-governance-demo.mov`, `.webm`, `.mkv`, etc. — any standard video format.)

## Verification

After recording, verify:

```bash
# Check that the file exists and is readable
./scripts/verify-demo-video.sh

# Or run the test
pnpm verify
```

The test will confirm:
- [x] Video file exists in `demos/recordings/`
- [x] File is readable and non-zero size
- [x] Recording README is present

## What the Video Should Show

The video demonstrates the full `observe → detect → correct → enforce → audit → improve` loop:

1. **Observe** (beats 1–3)
   - Workspace initialized
   - Business goal: "Close Acme expansion by Friday — $1.2M ARR"
   - Agent output reads "on-track" (the false green)

2. **Detect** (beats 4–5)
   - Lost EU data-residency requirement revealed
   - GovernanceCase `gc_acme_eu` flags the miss

3. **Correct** (beat 6)
   - Operator clicks "Approve + Enforce"

4. **Enforce** (beats 7–10)
   - Status visibly flips: On Track → At Risk
   - Simulated Linear workstream appears
   - Product/Security/Engineering owners required
   - False customer-facing update is blocked

5. **Audit** (beat 11)
   - AuditEvent recorded (correction + deciding actor)

6. **Improve** (beats 12–14)
   - EvalCase generated
   - Second pass re-runs with requirement enforced
   - Eval table shows Fail → Pass

## Key Points for the Video

- **No live calls:** All data comes from deterministic fixtures (no Gemini/Linear/LiveKit flakiness)
- **No invented persona names:** The operator is referred to only as "VP Ops / Head of AI Transformation" (a role, not a name)
- **All must-not-cut items visible:** Every artifact in `DEMO_CONTRACT.md` must-not-cut list #1–#7 should be on screen
- **Under 3 minutes:** Total demo should complete in under 3 minutes
- **Deterministic:** Re-recording should produce the same result every time

## If the App Glitches

If the live app freezes or errors during recording:

1. Stop recording
2. Restart the dev server (`Ctrl+C`, then `pnpm dev` again)
3. Restart recording
4. Resume from the last beat shown

Alternatively, use the **fallback walkthrough** in `demos/fallback/WALKTHROUGH.md`, which is a written step-by-step transcript of all 14 beats with fixture values.

## After Recording

1. **Verify the video exists:**
   ```bash
   ./scripts/verify-demo-video.sh
   ```

2. **Run tests to confirm:**
   ```bash
   pnpm verify
   ```

3. **Update SUBMISSION.md** once the video is recorded:
   - [ ] Demo video URL: `demos/recordings/acme-governance-demo.mp4`

4. **Commit and push:**
   ```bash
   git add demos/recordings/
   git commit -m "LIM-1197: record demo walkthrough (14-step Acme false-green scenario)"
   git push origin <branch>
   ```

---

**Questions?** See `demos/fallback/WALKTHROUGH.md` for the exact values shown in each beat, or `DEMO_CONTRACT.md` for the locked 14-step required path.
