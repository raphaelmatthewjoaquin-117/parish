# Implementation Plan: Photo Gallery Albums

## Overview

Extend the existing admin photo-gallery editor so staff can manage album contents: create albums by uploading photos, add more photos to an existing album, edit an album title, and choose the album-cover photo shown on the public gallery tile. Public album pages will show every photo in that album. Preserve the current one-photo-per-tile content and homepage preview behavior.

## Architecture Decisions

- Keep the existing site-content gallery document and upload endpoint; no new database table or dependency is needed.
- Keep each existing gallery item as an album and keep `image` as the selected cover URL, since the homepage preview and public gallery tiles already use it.
- Add an optional `photos` URL array to gallery items. For older saved content with no `photos`, treat `image` as the album's only photo. When `photos` is present, it contains all album photo URLs, including `image`.
- Keep current role checks, upload limits, and save/publish workflow. Uploading media does not publish gallery changes until the editor saves.
- Prevent removing the album's last photo; when changing covers, allow choosing only a photo belonging to that album.

## Task List

### Phase 1: Gallery content compatibility

- [x] Task 1: Extend the gallery content contract and server validation to accept bounded album photo arrays while continuing to accept existing gallery documents.

### Phase 2: Admin album management

- [x] Task 2: Update the gallery editor to add albums, add photos to albums, edit titles, select cover photos, and remove photos/albums with the existing save-and-publish workflow.

### Checkpoint: Admin management

- [x] Existing gallery content still loads and saves without losing photos.
- [x] Staff can create and edit albums, and validation prevents invalid/empty albums.

### Phase 3: Public album pages

- [x] Task 3: Render all album photos on the public album page and keep the selected cover consistent on gallery tiles and the homepage preview.

### Checkpoint: Public flow

- [x] The public gallery displays every album and each album detail page displays its photos.
- [x] A legacy one-photo gallery still displays correctly.

### Phase 4: Verification

- [x] Task 4: Add or update focused tests for validation, editing, legacy data, and public album rendering; run focused tests, full tests, lint, and build/type checks.

### Checkpoint: Complete

- [ ] All gallery acceptance criteria pass, including manual admin publish verification.
- [ ] No unrelated working-tree changes are included or overwritten.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Existing saved gallery documents contain only `image` | High | Treat missing `photos` as a one-photo album and retain `image` as the cover. |
| Cover URL and album photos become inconsistent | Medium | Validate that a selected cover is present in the album photo list and constrain the admin selector to that list. |
| Removing a photo makes an album empty or removes its cover | Medium | Require at least one remaining photo and select a remaining cover before allowing the current cover to be removed. |
| Newly uploaded files are not part of the published gallery until save | Medium | Preserve the existing upload-then-save flow and communicate its pending/published state in the editor. |
| The current full build has unrelated TypeScript errors in `AdminOperationsPage.tsx` | Medium | Run targeted lint/tests and build/type-check after changes; report the pre-existing blocker separately rather than expanding scope. |

## Open Questions

- None. Scope confirmed: albums can contain multiple photos; admins can edit the tile title and choose its cover photo.
