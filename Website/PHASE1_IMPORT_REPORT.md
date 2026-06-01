# Phase 1 import report

Imported Nathan CSV export into `Website/data/projects.json`.

- Projects imported: 85
- Comments imported and embedded in matching projects: 151
- Legacy image URLs preserved, but not used for display: 86
- Legacy video URLs preserved, but not used for display: 53

The old Supabase media URLs are kept under `legacy_media` because Nathan indicated the bucket/database no longer exists. To restore media, place files in `Website/data/media/<project-slug>/` and add relative paths to that project’s `image_urls` or `video_urls`.
