# Reddit History Visualized

**[View the live visualization](https://gregbahm.github.io/RedditData/)**

A visualizer for my personal Reddit history (posts and comments with score data).

## Using the visualizer

```
git clone https://github.com/GregBahm/RedditData.git
```

Then open `viz/index.html` in a browser. That's it — the repo is self-contained.
The visualizer reads only `viz/data.js`, the pre-built dataset committed here
(all posts/comments merged with scores and thread titles).

## Regenerating the data

`viz/data.js` is built by `fetch_scores.ps1` from a Reddit personal data export
(the CSV export from https://www.reddit.com/settings/data-request). The export
itself is **not** in this repo — it's large and private. The script:

1. Reads `posts.csv` and `comments.csv` from the export folder
2. Fetches score snapshots (and thread titles for comments) from the
   [Arctic Shift](https://arctic-shift.photon-reddit.com) archive API,
   since Reddit's export contains no scores
3. Merges everything and writes `viz/data.js`

To rerun it, you need an export folder on disk, and you'll need to edit the
hardcoded `$exportDir` and `$outFile` paths at the top of `fetch_scores.ps1`
to match your machine.
