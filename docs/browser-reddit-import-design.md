# Browser Reddit Import Design

## Goal

Let visitors visualize their own Reddit history from the public GitHub Pages
site without cloning the repository or installing software.

The import must run in the visitor's browser. The Reddit export ZIP must not be
uploaded to this project or to a service operated by the project.

## Entry point

Add a button labeled exactly:

> Show me my own data

Place it in the main 2D visualizer header where it is visible without obscuring
the existing controls. Keep the current committed `viz/data.js` as the initial
demo dataset until a visitor imports their own data.

Activating the button opens an import screen over the visualizer. Use a modal
dialog or full-screen panel that:

- Clearly identifies itself as the personal-data import flow.
- Can be dismissed without changing the currently displayed dataset.
- Traps keyboard focus while open and restores focus to the entry button when
  closed.
- Supports Escape and an explicit close button.

## Import screen

### Instructions

Explain the following in plain language:

1. Open Reddit's [data request page](https://www.reddit.com/settings/data-request).
2. Request the account's data using the available export option.
3. Wait for Reddit to email the download link.
4. Download the ZIP without extracting it.
5. Return to the visualizer and choose or drop that ZIP.

Also state:

- The ZIP is read locally in the browser and is not uploaded to this project.
- Reddit's export does not include scores.
- Post and comment IDs will be sent to the third-party
  [Arctic Shift](https://arctic-shift.photon-reddit.com) archive to retrieve
  score snapshots and comment thread titles.
- Some archived items may be unavailable.

Do not imply that the Arctic Shift lookup is private or performed locally.

### ZIP selection

Provide a large drop target with concise text such as:

> Drop your Reddit export ZIP here
>
> or click to choose a file

Follow standard file-upload behavior:

- Back the target with `<input type="file" accept=".zip,application/zip">`.
- Clicking anywhere in the target opens the native file picker.
- Keep the input keyboard accessible.
- Give the target a visible active state while a file is dragged over it.
- Route dropping and picker selection through the same validation/import code.
- Accept one ZIP at a time.
- Reject non-ZIP files with a visible, actionable error.
- Do not process a file merely because it is dragged over the page.

## Data pipeline

The existing `fetch_scores.ps1` is the behavioral reference for enrichment.
Reimplement its deterministic processing in browser JavaScript; no AI service is
involved.

### 1. Read the ZIP

Use a browser-compatible ZIP library. JSZip is a reasonable default.

Find `posts.csv` and `comments.csv` by filename rather than assuming a specific
top-level directory. Treat a missing file as an error that names the missing
file. Ignore unrelated export files.

### 2. Parse and validate CSV files

Use a robust CSV parser rather than splitting lines manually. Papa Parse is a
reasonable default because Reddit text can contain commas, quotes, and
newlines.

Validate the columns consumed by the app:

- `posts.csv`: `id`, `date`, `subreddit`, `title`, `body`, `permalink`
- `comments.csv`: `id`, `date`, `subreddit`, `body`, `permalink`, `link`

Surface an explicit incompatibility error if Reddit changes the export format.
Do not silently produce an empty visualization.

### 3. Build local records

Map rows to the shape currently consumed from `viz/data.js`:

```js
{
  id,
  type,       // "post" or "comment"
  date,
  sub,
  title,
  body,
  score,
  link,
  thread      // comments only
}
```

Retain rows while enrichment is in progress. Missing enrichment must not cause
the visitor's own post or comment text to be discarded.

### 4. Enrich through Arctic Shift

Match the current script's API behavior:

- Request post scores in batches of at most 100 IDs.
- Request comment scores in batches of at most 100 IDs.
- Extract unique thread post IDs from comment `link` values.
- Request thread titles in batches of at most 100 IDs.
- URL-encode query parameters.
- Limit concurrency rather than firing every request at once.
- Retry transient failures with bounded exponential backoff.
- Respect rate-limit responses and retry headers.
- Allow the visitor to retry after a terminal network failure.

Arctic Shift currently allows cross-origin requests, but that is an external
dependency and may change. Keep enrichment isolated so a proxy or different
provider can be substituted later.

If an individual ID is not found, retain the record and mark its score as
unavailable. Define how the visualizer represents unavailable scores; do not
conflate unavailable with a real score of zero.

### 5. Hand data to both visualizers

Refactor the 2D visualizer so initialization accepts an array instead of reading
only the global `REDDIT_DATA` constant. Initialize with `REDDIT_DATA` on page
load, then replace the active dataset after a successful import.

The 3D page reads `REDDIT_DATA` independently. Persist the processed dataset in
IndexedDB so navigation to `experiment.html` uses the same active personal
dataset. Do not use `localStorage` for the dataset because Reddit histories can
exceed its practical storage limit.

Keep the committed demo data as fallback and provide a visible way to return to
the demo or clear imported data.

## Import states

Show explicit UI states rather than only console output:

- **Ready:** instructions and drop target.
- **Reading ZIP:** file name and indeterminate progress.
- **Parsing:** identify which CSV is being processed.
- **Fetching scores:** completed and total batches or records.
- **Fetching thread titles:** completed and total batches or records.
- **Complete:** counts for posts, comments, enriched records, and unavailable
  records, followed by an action to display the imported visualization.
- **Error:** a human-readable explanation and a retry or choose-another-file
  action.

Disable duplicate imports while processing. If the screen may be closed during
processing, either keep processing with a visible status indicator or provide a
real cancel action backed by `AbortController`.

## Privacy and safety

- Never send CSV contents, titles, bodies, usernames, or the ZIP to Arctic
  Shift. Send only IDs required by its endpoints.
- Do not add analytics around imported data.
- Do not log imported records to the console.
- Render imported text as text, not unsanitized HTML. Review existing detail and
  tooltip rendering before feeding it arbitrary exports.
- Accept links only when they are expected Reddit `http` or `https` URLs.
- Keep imported data scoped to the browser profile unless explicitly cleared.

## Suggested code organization

Avoid adding all import logic to the already large inline script in
`viz/index.html`.

- `viz/import/import-dialog.js`: dialog behavior, drag/drop, picker, and states.
- `viz/import/reddit-export.js`: ZIP reading, CSV validation, and row mapping.
- `viz/import/arctic-shift.js`: batching, rate limiting, retries, enrichment.
- `viz/import/dataset-store.js`: IndexedDB and active dataset selection.
- `viz/import/import.css`: import presentation if separate styles are clearer.

Libraries may be vendored under `viz/vendor/` so the site remains self-contained
and does not send page-load metadata to a CDN. Record library names, versions,
licenses, and upstream URLs in the README.

## Implementation order

1. Extract 2D initialization so it can render a supplied dataset.
2. Add the entry button and accessible import screen.
3. Implement picker, drag/drop, ZIP reading, and CSV parsing.
4. Render a locally parsed dataset without score enrichment.
5. Implement Arctic Shift batching, retries, progress, and unavailable scores.
6. Add IndexedDB persistence and connect the 3D visualizer.
7. Add clearing and restoring-demo controls.
8. Update the README for public usage and privacy behavior.

## Completion checklist

- The complete flow works from the deployed GitHub Pages URL.
- Click-to-select and drag-and-drop work with Reddit's unmodified ZIP.
- Canceling the picker leaves the current visualization unchanged.
- Invalid files and changed or missing CSV formats produce visible errors.
- Large exports do not freeze the UI for extended periods.
- Rate limiting and partial archive coverage do not lose local records.
- The 2D and 3D views display the same imported dataset.
- Refreshing and navigating between views preserve an imported dataset.
- Clearing personal data restores the committed demo dataset.
- Keyboard-only and mobile users can operate the import screen.
- Imported titles and bodies cannot inject markup or script.
- No export data is committed or transmitted beyond documented ID lookups.
