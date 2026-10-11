# Edit mode: live test runs

A screen in edit mode that shows every end-to-end test run on this machine as it happens, whoever started it (you, a script or an agent), from any worktree. It's simple at a glance, with detail one click deeper. Its promise: at any moment you can tell whether a run is working, slow, stuck, failed or gone, and whether a failure is caused by the change being tested. This page is the spec (v3: user needs first, §1 to §3; the earlier sketches critiqued in §9) and its plan (§10). Phase 1 is built: what it does, and where it differs from the spec, is in §11.

> **TL;DR.**
> - **For:** you, the owner, while agents validate changes and you keep working; the agents themselves, which read the same state; and whoever fixes a failure.
> - **The problem:** a long run looks the same whether it's working, waiting, stuck or dead. A run takes an hour in software rendering, and one game test can wait five minutes inside one call. And when a test fails, you can't tell whether this change caused it.
> - **The promise:** nothing on screen is more than 2 seconds old without saying so. Any quiet stretch over 10 seconds says what the run is waiting on, how long it has waited and when it gives up. Every failure says whether it's new, already failing before, or flaky.
> - **How:**
>   - a reporter that sends a heartbeat every second;
>   - a launcher that records who started the run, why, on what code, its phases and its process;
>   - one unit-tested health rule;
>   - a comparison with the stable tree's runs;
>   - a screen in three levels (a status in edit mode's top bar, one sentence and a tree, detail on request);
>   - the same state for agents, from one command.
> - **Plan:** four phases; the first (live, honest and attributable) is about two days.

## 1. Who it's for

| User | Who they are | What they need from it |
|---|---|---|
| **The owner** (primary) | A design leader who uses edit mode daily. Agents run long checks in the background while he edits content. He knows what the site should do, not Playwright's internals, and won't read raw logs. | Confidence without watching; a plain answer to "is it working?"; whether a failure matters; the power to stop or re-run; no disruption to his own site. |
| **Agents** (secondary, frequent) | Coding agents that start most runs from the command line and report back. Today one had to read log files by hand to answer "are you stuck?". | The same state in a form they can read, so their answer and the owner's screen agree; a way to say why they started a run. |
| **The fixer** (occasional) | The owner or an agent, digging into one failure. | The error, the step, the code line, the screenshot and the trace, two clicks from the failure. |

## 2. Jobs and scenarios

### 2.1 Jobs to be done

1. **Keep working in peace.** When an agent is validating a change, I want to see at a glance that it's making progress, so I can keep editing without wondering.
2. **Read a silence.** When nothing has changed for a while, I want to know whether it's working, waiting, stuck or dead, so I can decide to wait, stop or re-run.
3. **Judge a failure.** When a test fails, I want to know whether this change caused it, it was failing before, or it's flaky, so I know whether the work is safe.
4. **Decide when it's done.** When a run ends, I want a plain summary of what it proved and what it didn't, so I can merge, deploy, or send it back.
5. **Protect my machine.** When things feel slow or runs overlap, I want to see what's running and stop it, so my own work and site aren't disrupted.
6. **Catch up.** When I come back later, I want to see what happened while I was away, stalls included.
7. **Trust the agent.** When an agent says it's running tests, I want to see the same run it means, with its purpose, so I can check its claims.

### 2.2 Scenarios

| # | Scenario | What the screen does |
|---|---|---|
| S1 | An agent starts a full suite while the owner edits an article | The top bar shows "Tests: running · 64 / 211 · on track · 1 s ago"; nothing else interrupts |
| S2 | Nothing has moved for four minutes | One sentence: "Waiting for page.evaluate in the swing test · 2:41 of a 5:00 limit · the test usually takes 3:40" |
| S3 | The runner crashes or is killed | "The run ended unexpectedly at 14:22 (exit code 1)", its last output lines, and Re-run |
| S4 | A test fails mid-run | It's pinned at the top with its verdict: "New: passes on the stable tree", "Known: fails on the stable tree too" or "Flaky: passed on retry" |
| S5 | The run ends | The summary: passed, failed (new and known), flaky, not run, time; "Copy summary" for a chat with the agent |
| S6 | Two runs overlap | Both shown; "2 runs at once: tests may time out", each with Stop |
| S7 | A test server from an earlier run is reused | "Using a test server started at 13:05 from the audit branch, not this run's build", called out |
| S8 | The owner wants his machine back | Stop, with what will and won't have been checked |
| S9 | A failure might be flaky | Re-run just that test, here or on the stable tree |
| S10 | Back after an hour | The run's timeline: phases, stalls, failures, each with its time |
| S11 | The owner asks the agent "are you stuck?" | The agent runs one command and answers with the screen's own sentence |

## 3. What the user can do

| # | The user can… | Job | Phase |
|---|---|---|---|
| U1 | see from any edit-mode screen whether a run is active, its health and its progress | 1 | 1 |
| U2 | read, in one sentence, what the run is doing now and whether that's normal | 1, 2 | 1 |
| U3 | see how long the current step has run, its time limit, and the test's usual time | 2 | 1 |
| U4 | see how much is done and roughly how long is left | 1, 4 | 1 |
| U5 | tell working, slow, idle-waiting, silent, ended-unexpectedly, failed and passed apart, each with its reason | 2 | 1 |
| U6 | see who started the run, why, on which worktree, branch and commit, and against which server; and that it doesn't touch the site on 4321 | 7, 5 | 1 |
| U7 | expand from areas to files, groups, tests and a test's live steps, and have the view follow the running test | 2 | 1 |
| U8 | see every failure pinned, with its verdict: new, known (fails on the stable tree), or flaky | 3 | 1 |
| U9 | read a failure's cause in plain words, then its error, step, code line and screenshot | 3 | 1 (words, error, step); 2 (the rest) |
| U10 | see a finished run's summary, and copy it | 4 | 1 |
| U11 | see the runs active now and be warned when they overlap | 5 | 1 |
| U12 | look back at past runs and a run's timeline | 6 | 1 (list); 2 (timeline) |
| U13 | open a test's trace, logs and its line in VS Code | 3 | 2 |
| U14 | be notified when a run ends or first fails, without watching | 1 | 2 |
| U15 | stop a run | 5 | 3 |
| U16 | re-run the failed tests, or one test, here or on the stable tree | 3, 4 | 3 |
| U17 | (an agent) read the same state and sentence with one command | 7 | 1 |
| U18 | do all of it by keyboard and screen reader, never relying on colour | all | 1 |

## 4. Signals

The transparency comes from the data, not the screen. Three sources feed one folder per run.

### 4.1 The reporter (always on)

A custom Playwright reporter, `tests/reporters/live.ts`, is in `playwright.config.ts` beside the console reporter for every local run, so no run can be invisible (U1). It appends one JSON line per event to `.test-runs/<run id>/events.ndjson`:

- `begin`: the run's whole tree (projects, files, groups, tests with IDs, locations and time limits);
- `test-begin`, `test-end`: status, duration, retry, errors with their code excerpt and location, attachment paths;
- `step-begin`, `step-end`: category (hook, fixture, page action, `expect`, `test.step`), title, location, and the step's own time limit where it has one;
- `out`: a test's console lines;
- `beat`, **every second, whatever is happening** (U2, U3): the running test and its innermost step, how long each has run, their time limits, and the CPU time the run's processes used since the last beat.

Repeated steps are folded as they arrive ("expect.poll · 37 tries · 18 s"), so a polling wait is one line, not hundreds.

### 4.2 The launcher

`scripts/test-run.mjs` starts every run: the `e2e` npm script, the Tests screen, and agents (AGENTS.md says to use it). It records what the reporter can't see:

- **who and why** (U6): `--by owner|agent|script` and `--purpose "Validate the design systems audit"`; agents are expected to give both;
- **what code:** the worktree, its branch, its commit, and whether it has uncommitted changes;
- **phases:** building the test site (with the build's last lines), starting the server, running, finishing;
- **the server it's using:** fresh or reused; if reused, when its build was made and from which branch and commit (S7);
- **the process:** its ID, then its exit code and why it ended;
- **CPU:** the process tree's use, sampled every 2 seconds;
- **other runs:** any other active run on the machine (S6).

A run started without the launcher still reports through the reporter, as "started by: unknown", with no build phase; the screen says so.

### 4.3 For agents

`node scripts/test-run.mjs status` prints the newest active run's state in the screen's own words (its sentence, its counts, its health and failures), and `--json` prints `state.json` (U17, S11). `state.json` is a documented contract.

## 5. Judging results

- **Health** is one pure function (`src/site/editor/model/testHealth.ts`, unit-tested). It turns the latest signals into a state, always shown with its reason in words:

| State | When | What it says |
|---|---|---|
| On track | Heartbeats arriving; the step within its usual time | "Running" |
| Slower than usual | The step or test is over 1.5× its median across past runs (or, with no history, past half its limit), and the processes are using CPU | "Slower than usual: 2:41, usually 1:10; still working" |
| Waiting, idle | A step has run 20 s with no CPU use | "Waiting for page.evaluate, CPU idle 34 s; gives up in 2:19" |
| No word | No heartbeat for over 5 s | "No word from the run for 12 s; its process is running" (or isn't) |
| Ended unexpectedly | The process is gone with no `end` event | "The run ended unexpectedly at 14:22 (exit code 1)", its last output lines |
| Failed | A test failed, or the build or server did | The test with its verdict, or the cause ("Port 4329 is in use") |
| Passed | All done, as expected | "Passed: 211 tests in 48 min" |

- **A failure's verdict** (U8), from the test's history:
  - **New:** it passed in the stable tree's (`main`) latest run of that test;
  - **Known:** it failed there too;
  - **Flaky:** it passed on a retry, or its last runs both passed and failed;
  - **Unknown:** no run on the stable tree to compare with, with a button to run it there (phase 3).
- **The summary** (U10) is written for a decision: "208 passed. 3 failed: 1 new (the swing), 2 known. Not run: none. 48 min. This change is safe for everything except the swing." It's copyable as plain text.

## 6. The screen

At `/_edit/tests/`, with a Tests item in edit mode's navigation. It's built from the site's design system (Progress, Tag, Tabs, ScrollArea, Dialog) with the editor's own tokens. It saves nothing, and its words follow the copy rules (plain, sentence case, no jargon a non-engineer wouldn't use; the Playwright term is kept beside it where it helps the fixer).

### 6.1 Level 0: a status everywhere in edit mode (U1)

A compact status in edit mode's top bar, beside the save status, while a run is active and for an hour after it ends:

- its health in a word, with a dot (never colour alone);
- "164 / 211" and the failures;
- "1 s ago", ticking.

Click it to open the Tests screen. While a run is active, the browser tab's title carries its progress too.

### 6.2 Level 1: the run, in one sentence (U2 to U6, U11)

```
● On track · 164 of 211 · 3 failed (1 new) · about 22 min left                    last signal 1 s ago
Now: crafting › the swing › build the swing · waiting for page.evaluate · 2:41 of 5:00 ·
     the test usually takes 3:40
Started by an agent at 14:12 · "Validate the design systems audit" · audit branch @ ff10aa1 ·
     its own test server (fresh, 14:15) · your site on localhost:4321 isn't touched
[ Build ✓ 3:12 ] › [ Server ✓ 0:20 ] › [ Tests ● 41:05 ] › [ Done ]
███████████████████████████████████▒▒░░░░░░░░░░  passed · failed · flaky · running · queued
```

- The phase strip lights the current phase with its own timer.
- The bar's segments use a pattern as well as colour.
- Time left is estimated from each test's median time across past runs.
- Overlapping runs show a warning line with each run's Stop (phase 3; until then, the command to stop it).

### 6.3 Level 2: the tree (U7, U8)

- **Failures** are pinned above the tree, each with its verdict.
- The tree starts at the **areas** (the planet, the website, edit mode, protected pages: named from the spec files), collapsed, each with its roll-up counts and health. Then come the groups, then the tests (their titles are already plain sentences).
- **Follow** (on by default) keeps the running test open and in view. Scrolling away turns it off; a button turns it back on.
- Expanding a test shows its **live step tree**. The current step's timer ticks every 250 ms, counted in the browser between heartbeats, so a clock never freezes.
- Filters for status and verdict, and search.
- The APG tree pattern: arrow keys, Home, End, `*` to expand a level. Expanded rows and Follow are kept per run.

### 6.4 Level 3: on request (U9, U13)

The failure in plain words ("Timed out after 5:00 waiting for the page to answer"), then the error with its code excerpt and a link that opens the line in VS Code; the screenshot, the video and the console; the build's and the server's logs; and **Open trace**, which opens Playwright's own trace viewer (it ships with Playwright; edit mode serves it) for every action, snapshot and network call.

### 6.5 After, and over time (U10, U12, U14)

- **The summary** replaces the "Now" line when a run ends.
- **The timeline:** phases, stalls (each "waiting, idle" or "no word" stretch, with its length), failures and the end, each with its time.
- **History:** a run picker with the last 20 runs per worktree (who, why, status, counts, duration). A run's link lasts.
- **Notifications** (opt in, phase 2): the browser's own notification when a run ends or first fails.

### 6.6 Freshness and accessibility (U18)

- Every panel shows its "as of" time; anything older than 2 seconds is greyed with its age.
- Health and verdicts are always in words. A failure, a stall and the end are announced politely to screen readers; passes are not.

## 7. Transport

- **Files:** per run, the append-only `events.ndjson`, `run.json` (who, why, what code, the server, the process) and a `state.json` snapshot rewritten every second, so a screen opened mid-run shows the state at once. The last 20 runs are kept per worktree. `.test-runs/` is ignored by git.
- **Every worktree:** the server finds runs in all of them with `git worktree list`, so the stable tree's edit mode shows a branch's runs, named by branch (U6).
- **To the page:** the server reads each active run's file every 250 ms (more reliable than `fs.watch` on Windows) and pushes new lines by server-sent events. A reconnect resumes from its last line. The client batches renders per animation frame.
- **Safety:** dev only, like all of edit mode (`verify:prod` fails on any trace of it in a build). Attachment routes can't reach outside a run's folder. Starting a run (phase 3) builds its command from a fixed list of options, never a shell string, and stops a run by its process ID. No new dependency.

## 8. Checks

- **Unit:**
  - the health rule (every state and its reason);
  - verdicts (new, known, flaky, unknown);
  - folding events into the tree and its counts, and folding repeated steps;
  - time estimates;
  - the summary's sentence.
- **The reporter and the launcher:** fed a recorded event sequence and a fake process, they write the expected lines, beats, phases and exit.
- **E2E (editor project):** a fixture run replayed at speed shows every health state and verdict; the top bar follows it on another screen; the tree follows the running test; nothing stays older than 2 s without saying so.
- **By hand:** a real run, watched once: every quiet stretch over 10 s is explained, and the agent's `status` matches the screen.

## 9. Earlier sketches, critiqued

**v1** was a reporter and a detailed screen. **v2** fixed its gaps in the signals (a heartbeat, deadlines, liveness, the phases, three levels). **v3** starts from the users, and adds what their jobs need and neither sketch had:

| Gap | Found in | Now |
|---|---|---|
| Events only: a long call or the build sends nothing | v1 | A heartbeat every second (§4.1) |
| Time without a deadline | v1 | Against the usual time and the limit (§5, §6.2) |
| No liveness: a crashed run shows "running" forever | v1 | The process watched (§4.2, §5) |
| Blind before the tests | v1 | The launcher's phases and server (§4.2) |
| Detail on the first screen | v1 | Three levels (§6) |
| Only on its own screen | v1 | A status in edit mode's top bar (§6.1) |
| Opt-in reporter | v1 | Always in the config (§4.1) |
| Floods and file watching | v1 | Folded steps; polling (§4.1, §7) |
| No way to tell whether a failure matters: the question that took most of the time when this was first needed | v2 | Verdicts against the stable tree's runs, and a summary written for a decision (§5) |
| No provenance: who started a run, why, on what code; whether the owner's site is touched | v2 | `--by` and `--purpose`, the worktree, branch, commit and server (§4.2, §6.2) |
| Agents couldn't read the state | v2 | `status` and `state.json` (§4.3) |
| Overlapping runs slow each other unseen | v2 | Active runs and a warning (§4.2, §6.2) |
| Nothing to catch up on after time away | v2 | The timeline and history (§6.5) |
| Engineer's words | v2 | Plain words first, the Playwright term beside them (§6) |

## 10. Plan

| Phase | Scope | User-cans | Done when |
|---|---|---|---|
| 1. Live, honest and attributable (about 2 days) | The reporter with its heartbeat and CPU; the launcher with who, why, what code, phases, server, process, exit and other runs; the health rule; verdicts against the stable tree; the summary; the agents' `status`; level 0 in the top bar; the Tests screen's levels 1 and 2; the run picker | U1 to U8, U9 (words, error, step), U10, U11, U12 (list), U17, U18 | The E2E replay shows every health state and verdict; in a real run nothing is more than 2 s stale and every quiet stretch over 10 s is explained; the agent's `status` matches the screen |
| 2. Depth (1 day) | Level 3 (the trace viewer, screenshots, logs, VS Code links), the timeline, time estimates, notifications | U9, U12, U13, U14 | Every failure shows its cause in two clicks; a run read an hour later explains its stalls |
| 3. Control (1 day) | Stop; re-run the failed tests or one test, here or on the stable tree | U15, U16 | A run started from the screen looks the same as one from the command line; a stop leaves no process behind |
| 4. Unit tests | Vitest runs on the same screen | U1 to U10 for unit runs | The same promise holds for unit runs |

It's built in a worktree, checked on its own port, then merged. The new route needs one restart of the dev server (about 20 seconds). AGENTS.md gains one rule: start every test run through the launcher, with `--by agent` and a `--purpose`.

## 11. As built (phase 1, 11 October 2026)

- **Where:** `/_edit/tests/` (a Tests item under Checks in edit mode's navigation), and the status in edit mode's top bar.
- **The pieces:**
  - the reporter, `tests/reporters/live.ts`, in `playwright.config.ts`;
  - the launcher, `scripts/test-run.mjs` (`npm run e2e` goes through it);
  - the pure model, `src/site/editor/model/testRun.ts`: folding, health, verdicts, the summary and time left;
  - the reading side, `src/site/editor/server/testRuns.ts`: finding runs in every worktree, judging them, one test's detail;
  - the API under `/_edit/api/tests/`: `runs`, `runs/<id>`, `runs/<id>/tests/<test id>`, and `stream`, server-sent events every half second (`brief=1` once a second for the top bar);
  - the parts, `TestRuns.astro` and `TestStatus.astro`, and their scripts, `scripts/tests.ts` and `scripts/testStatus.ts`.
- **Built as specified:** U1 to U8, U10, U11, U12 (the list), U17 and U18. Error, code excerpt, output and the paths of kept files are shown (part of U9).
- **Where it differs:**
  - **CPU is the machine's,** not the run's process tree: the reporter samples `os.cpus()` each second. "Waiting, idle" means the whole machine has been idle for 20 s, which is what a stuck test looks like here, and it needs no dependency. So the screen labels it as such ("machine CPU 28% (all programs, not only the tests)"), shows it only while a run is active, and calls it idle only below 10%; a finished run shows when it finished instead.
  - **A step's own time limit isn't known:** Playwright's reporter API gives a test's limit, not a step's. The screen shows a step's time, and the test's time against its limit.
  - **A reused server is found by its port** (something already listening on 4329 or 4330 before the run), not by its build time and commit.
  - **The tree opens in place:** a test opens under its row, rather than in a pane beside the tree. Following closes a test it opened itself once that test passes, so it never leaves a trail; failures, and anything you open, stay open.
  - **Verdicts need a run on the stable tree:** until one has been run through the launcher there, a failure reads "Not compared".
- **Not built yet (phases 2 to 4):** the trace viewer, screenshots shown in place, VS Code links, the timeline, notifications, stop and re-run, and Vitest.
- **Checks:**
  - `tests/unit/testRun.test.ts`: folding, folded repeats, every health state with its reason, verdicts, the summary, time left;
  - `tests/e2e/editor-tests.spec.ts` (the editor project): a fixture run with a heartbeat kept fresh shows the sentence, the failure and its verdict, the step clocks ticking and the tree following the running test; once the heartbeat stops, the screen says "No word" within seconds.
