# Phase 2: recovering media from public project pages

The old Supabase media bucket is gone, so the repo cannot directly restore those files. This phase adds a helper script that can fetch images from public project pages, mainly Instructables pages, and copy them into the self-contained repo.

Run from the repository root:

```bash
python3 -m pip install requests
python3 tools/recover-public-media.py --dry-run
```

Review:

```text
Website/data/media-recovery-report.csv
```

Then run the real recovery:

```bash
python3 tools/recover-public-media.py
```

The script will:

- read `Website/data/projects.json`,
- visit each project’s `project_link`,
- search for likely image URLs,
- score them against the project title, slug, and old missing filenames,
- download matches into `Website/data/media/<project-slug>/`,
- update that project’s `image_urls` with local paths.

Afterwards, open the website locally and visually inspect the recovered images. Commit only the matches that look correct.

Notes:

- Videos are not automatically recovered in this pass.
- Some Instructables pages may block scripted fetching or may no longer exist.
- The matching is conservative but not perfect; manual review is still required.
