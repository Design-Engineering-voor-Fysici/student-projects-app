# Local JSON mode

This version no longer depends on Supabase at runtime.

## Data source

The site reads projects from:

```text
Website/data/projects.json
```

For Phase 0 this file starts empty, so you can test by adding one project through the existing `+` button in the browser.

## Important browser limitation

A static website cannot silently overwrite files in the cloned repository. Instead, edits are stored temporarily in the browser's `localStorage` and a yellow toolbar appears at the top of the page.

After adding or editing projects:

1. Click **Download projects.json** in the yellow toolbar.
2. Replace `Website/data/projects.json` in the repository with the downloaded file.
3. Commit and push the changed JSON file.

Use **Discard local edits** to clear browser-local changes and reload the current repo file.

## Testing locally

From the `Website` directory run:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

Do not open `index.html` directly from the file system, because browsers usually block `fetch()` requests to local JSON files.

## Media files

Image/video upload fields do not copy binary files into the repository. They only add expected local paths such as:

```text
data/media/project-1/example.jpg
```

Place the media files in those folders manually before committing. The next phase can improve this workflow.
