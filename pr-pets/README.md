# PR Pets: Toby and Jibble

A cartoon puppy and kitten who live in the bottom-left corner of your GitHub
pull request pages. Open a PR and Toby gets a treat. Submit a review and Jibble
gets one. Neglect them and they get quietly, visibly hangry.

<!-- Toby is an apricot doodle with long floppy ears; Jibble is a white kitten
     with grey-brown tabby patches over her crown and back and a green collar.
     Both are drawn as SVG from their photographs — the extension ships no
     image files at all. -->

## Installing

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and choose this `pr-pets` folder.
3. Visit any pull request page.

The toolbar popup has an on/off switch and a summary of how both pets are doing.

## The rules

| Pet | Species | Earns a treat by |
|---|---|---|
| **Toby** | puppy | opening a pull request |
| **Jibble** | kitten | submitting a review on an open pull request |

Pets appear on a repository's PR list, on every tab of an individual PR
(Conversation, Commits, Checks, Files), on the compare page where PRs are
created, and on the cross-repo `/pulls` dashboard.

### Moods

```
treat ──► HAPPY ──────► BORED ────────► HANGRY ─────────────►
          1–5 min,      until the       intensity ramps 0 → 1
          rolled at     threshold       over a further threshold,
          feeding time                  then holds
```

- **Happy** — bounces, sparkles, and says something in character with a
  matching bufo. The window is a random 1–5 minutes, rolled once at feeding
  time and stored, so it cannot re-roll on a page reload.
- **Bored** — baseline. Blinks at you.
- **Hangry** — a continuous ramp rather than a switch: a slight droop, a slow
  sway, a little desaturation, and an empty bowl fading in at the pet's feet.
  Ten minutes overdue looks *slightly* off; a day overdue looks properly sad.

### How long until hangry

**Each pet learns its own threshold, from your own use of the extension, in
your own browser.** It is the average time between that pet's treats so far —
so someone who opens a PR every half hour gets a pet that expects a treat every
half hour, and someone who reviews twice a week gets one that doesn't.

- **A fresh install starts at 3 hours** and has no history whatsoever. Nothing
  is bundled, nothing is shared between users or between machines, and nothing
  is sent anywhere. All state lives in `chrome.storage.local`.
- The average is taken over the **last 10 gaps**, so the pet tracks how you
  work now rather than how you worked in March.
- It is clamped to **[20 minutes, 24 hours]**. Without the floor, opening six
  PRs in one burst would leave a puppy hangry again before it finished saying
  thank you; without the ceiling, one holiday would make a pet unfeedable.

Toby and Jibble learn separately — reviewing rarely while opening PRs
constantly gives you exactly the two different pets you would expect.

### Setting it yourself

The menu has a **Gets hungry every `__` minutes / hours** field, with a unit
switch. It always shows the value actually in force:

- **3 hours** on a fresh install,
- then **that pet's own average**, once there are a couple of treats to measure
  (shown in a quieter, italic style, because it is inherited rather than
  chosen),
- **whatever you type**, from the moment you type it. A hand-set value is
  pinned: new treats keep updating the average underneath, but they will not
  move your number.

A **Revert to my average** button appears only while a value is pinned, and
hands the pet back to its own average. Switching between minutes and hours
re-expresses the same duration — 150 minutes becomes 2.5 hours — and never
writes anything.

Hand-set values are allowed from 5 minutes to 30 days. That is deliberately
wider than the 20-minute floor on the *learned* average: the floor exists to
stop a degenerate history producing an absurd pet, whereas someone who types
"10 minutes" has said what they want.

### The wardrobe

Click a pet to dress it: beanie, hackathon hoodie, USB-C hub, blue-light
glasses, headphones, conference lanyard, backpack. Each is drawn against the
anchors in `sprites.js` rather than against a particular pet, so one garment
fits both, and the paint order is fixed in `accessories.js` — a lanyard hangs
in front of whatever the pet is carrying however you click the chips.

Retiring a garment needs no migration: an id that leaves `ACCESSORY_IDS` is
filtered out of any pet already wearing it, by the same rule that drops an
unknown id saved by a newer version. `sweatpants` was retired that way, having
been the wrong idea rather than a badly drawn one — a round animal sitting
face-on has no legs on show, so trousers only ever read as a slab across its
middle.

## Design notes

The structure follows the 6.031 line on what makes code worth keeping: safe
from bugs, easy to understand, ready for change.

**Mood is derived, never stored.** `mood.js` is a pure function of
`(pet, now)`. A stored mood would be a second copy of the truth, and the two
copies drift the moment a background timer misses a tick or a laptop sleeps.
Deriving it means a tab closed for a week and one opened a second ago render
the same pet, and the clock can be lied to freely in tests.

**One immutable ADT per concept, with a rep invariant.** `petState.js` and
`appState.js` document an abstraction function and a rep invariant, run
`checkRep` on every load and every transition, and deep-freeze everything they
produce. Corrupt storage fails loudly at the boundary — or is repaired by
`fromJSON` — rather than quietly producing a pet that is hangry forever.

**Feeding is idempotent.** Detectors return a *stable event id*
(`opened:acme/web#412`), not a boolean, and `recordFeeding` counts an id at
most once. Reloading a PR, opening it in a second tab, or bouncing between the
Files and Commits tabs all produce the same id. That is what makes it safe for
the PR-opened check to run four times on a ladder, and for two independent
detection routes to exist.

**Abstraction barriers that pay rent.** The entire model layer is free of
`chrome`, the DOM, and the ambient clock, so `npm test` runs 92 tests in plain
Node with no browser and almost no mocks — the one fake is a nine-line
`chrome.storage` in `store.test.js`, which is the whole point of keeping the
adapter that thin. `store.js` contains no rules at all: it reads, hands the
document to a pure function, and writes the result back.

**Writes are serialised, and stay that way after one fails.** `update` puts
every write on a promise chain, because `chrome.storage` has no
compare-and-swap and two treats landing together would otherwise interleave
and lose one. The chain deliberately holds only settled promises: leaving a
rejected one as its tail would make every later write reject with that stale
error without running, so a single bad transition would quietly mean the pets
could never be fed again for the life of the page.

**Time and randomness are parameters.** Every producer takes `now` and `rng`,
which is why "the threshold becomes the average gap between treats" and "a
burst of treats cannot drive the threshold below the floor" are assertions
rather than things you wait three hours to find out.

## Layout

```
manifest.json
src/
  model/        pure: no chrome, no DOM, no ambient clock
    petState.js   one pet — immutable, with checkRep
    appState.js   the whole document, including idempotent feeding
    mood.js       happy / bored / hangry, derived from (pet, now)
    history.js    feedings → treats per local day
    phrases.js    thank-you lines, each paired with its bufo
  storage/
    store.js      the only module that touches chrome.storage
  view/
    sprites.js    Toby and Jibble, mood-parameterised SVG
    accessories.js the wardrobe, drawn against anchors so it fits both pets
    bufo.js       the frogs
    petCard.js    one pet on screen
    menu.js       rename / dress up / feeding history
    chart.js      the daily-treats column chart
    styles.css
  content/
    loader.js     content script; dynamically imports main.js as a module
    github.js     pure URL classification — which pages get pets
    events.js     DOM sniffing for "PR opened" and "review submitted"
    main.js       the controller
  popup/          the on/off switch
test/             92 tests, plain Node, no browser
dev/              preview.html (sprite sheet), wardrobe.html (garments at
                  size, on both pets) and harness.html (live UI)
```

`dev/` is for development only — the manifest never references it, and the
demo history in `harness.html` is fabricated. Delete the folder before
packaging if you would rather not ship it.

## Packaging and publishing

### Build the upload

```bash
npm run package
```

That runs the tests, then writes `pr-pets.zip` containing exactly
`manifest.json`, `icons/` and `src/` — 32 files. `dev/`, `test/`,
`package.json` and this README are deliberately left out: the Web Store review
reads what you upload, and there is no reason to ship a test suite and a
fabricated-data harness to every user.

The store requires `manifest.json` at the **root** of the zip, which is why the
script zips those three paths rather than the folder that contains them.

### Publish to the Chrome Web Store

1. **Register as a developer** at
   [chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole).
   There is a **one-time $5 USD registration fee** and it needs a Google
   account. Use an account you are happy to own the listing long-term.
2. **New Item → upload `pr-pets.zip`.**
3. **Store listing.** You will need:
   - a short description (132 characters max) and a longer one;
   - a category — **Developer Tools** is the right one here;
   - **at least one screenshot, 1280×800 or 640×400.** The best one is the
     extension running on a real PR: load it unpacked first (below), open one
     of your own pull requests, and screenshot that. `dev/harness.html` at
     1280×800 also works if you would rather not show a real repo.
   - The 128×128 icon is already in the zip.
4. **Privacy tab.** This is where extensions usually get held up, so be
   specific:
   - *Single purpose*: "Shows two cartoon pets on GitHub pull request pages
     that react to the user's own PR activity."
   - *Permission justification* — `storage`: "Saves the pets' names,
     accessories and feeding history locally." `host_permissions`
     (`https://github.com/*`): "The extension only runs on GitHub pull request
     pages, where it draws the pets and detects when the user opens a PR or
     submits a review."
   - *Data usage*: certify that you collect **none**. This extension stores
     everything in `chrome.storage.local` and makes no network requests at all,
     so every disclosure checkbox is "no".
   - A **privacy policy URL** is required for most listings. A short page
     saying "this extension collects and transmits no data; all state is stored
     locally in your browser" is enough — you have a personal site to host it
     on.
5. **Distribution**: public, unlisted, or private to specific testers. Unlisted
   is a good first step — the link works, but it will not appear in search.
6. **Submit for review.** Expect a few days; a broad host permission like
   `github.com` can attract a slower, more manual review.

**Updating later:** bump `"version"` in `manifest.json` (the store rejects a
re-upload of a version it already has), re-run `npm run package`, and upload
the new zip to the same item.

### Test it unpacked first

Do this before you pay anyone $5:

1. `chrome://extensions` → turn on **Developer mode**.
2. **Load unpacked** → choose the `pr-pets` folder (the folder, not the zip).
3. Open one of your pull requests. Use the reload icon on the extension card
   after any code change.

## Development

```bash
npm test
```

To look at the artwork and the live UI without loading the extension, **serve
the folder** — do not double-click the files. These pages import the real
source as ES modules, and Chrome fetches modules with CORS, so a `file://` page
has a null origin and every import is blocked: the headings render and nothing
else does. Each page checks for this and says so rather than sitting there
empty, but the fix is the same either way:

```bash
cd pr-pets && python3 -m http.server 4177
```

Then open <http://localhost:4177/dev/> and pick one of:

- `dev/preview.html` — every pet, mood and accessory, in both themes.
- `dev/wardrobe.html` — each garment and several combinations at 150px, on both
  pets. Worth opening after any change to `accessories.js` or to the anchors:
  clothing that is merely *plausible* in the numbers can still read as a grey
  slab on screen, and this is the page that says so.
- `dev/harness.html` — the real components against a fake `chrome.storage`, so
  renaming, dressing up and the hunger field are actually exercised.

## Known fragility

`events.js` reads GitHub's markup, which is not an API and is re-skinned
regularly. Every detector tries several selectors and treats "I can't tell" as
a reason to fall back rather than to throw, and the PR-opened check has two
independent routes to the same event id. If a treat ever stops arriving, that
file is where to look — and the tests in `test/events.test.js` cover the
decision logic, not the selector strings, which only a real page can validate.

The bufo frogs are drawn from scratch in the spirit of the emoji packs rather
than copied from them.
