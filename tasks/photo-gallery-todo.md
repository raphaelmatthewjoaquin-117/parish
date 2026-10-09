# Photo Gallery Album Tasks

## Task 1: Extending the gallery content contract

**Description:** Add an optional photo URL list to gallery albums, retain the existing cover URL field, and extend server-side validation without rejecting currently saved one-photo gallery documents.

**Acceptance criteria:**
- [x] Existing gallery documents with only `image` remain valid and render as one-photo albums.
- [x] New documents may include a bounded `photos` list of valid image URLs, and the selected `image` cover must belong to that list.
- [x] Malformed or oversized album photo lists are rejected by server validation.

**Verification:**
- [x] Run focused server content-validation tests.
- [x] Confirm legacy and new gallery document shapes with tests.

**Dependencies:** None

**Files likely touched:**
- `parishweb/src/content/siteContent.ts`
- `parishweb/server.js`
- `parishweb/src/server-rules.test.ts` or the existing server validation test file

**Estimated scope:** Medium

## Task 2: Managing albums in the admin editor

**Description:** Allow authorized gallery editors to upload a new album, add photos to an existing album, edit the album's English and Tagalog titles, select a photo as the tile cover, and remove individual photos or albums. Keep the existing explicit save-and-publish action.

**Acceptance criteria:**
- [x] Adding an album starts with its uploaded photo as its only photo and its cover.
- [x] Adding photos to an album retains its existing photos and cover unless an editor changes the cover.
- [x] Editors can change both titles and choose a cover from that album's photos.
- [x] An album cannot be left without photos; deleting a selected cover requires a valid remaining cover.
- [x] Upload, load, and save failures remain visible, and unsaved changes are not presented as published.

**Verification:**
- [x] Add focused editor tests for create, append, title edit, cover selection, and photo removal.
- [x] Run the existing site-content editor tests.
- [ ] Manually check keyboard access and mobile layout for new controls.

**Dependencies:** Task 1

**Files likely touched:**
- `parishweb/src/pages/SiteContentEditorPage.tsx`
- `parishweb/src/pages/SiteContentEditorPage.test.tsx`
- `parishweb/src/PagesCSS/SiteContentEditorPage.css`

**Estimated scope:** Medium

## Task 3: Showing album photos publicly

**Description:** Render all photos for a selected album on its public detail page while preserving the cover image on gallery tiles and the homepage preview.

**Acceptance criteria:**
- [x] A legacy album without `photos` shows its existing image on the detail page.
- [x] A multi-photo album shows each photo with meaningful alternative text based on its album title.
- [x] Gallery tiles and the homepage preview use the selected album cover.

**Verification:**
- [x] Run focused public gallery tests for legacy and multi-photo album data.
- [ ] Verify the public gallery and album detail view in the browser.

**Dependencies:** Task 1

**Files likely touched:**
- `parishweb/src/pages/GalleryPage.tsx`
- `parishweb/src/pages/GalleryPage.test.tsx`
- `parishweb/src/PagesCSS/GalleryPage.css`

**Estimated scope:** Small

## Task 4: Verifying the complete gallery flow

**Description:** Run the relevant validation, editor, public-view, and project checks; resolve regressions introduced by the feature and record unrelated existing blockers.

**Acceptance criteria:**
- [x] Gallery-focused tests and the full frontend test suite pass.
- [x] Lint passes for changed files.
- [x] Build/type-check is run; any existing unrelated failure is clearly identified and not silently worked around.
- [ ] Browser verification confirms album creation/editing is reflected after publish and public pages render the chosen cover and all photos.

**Verification:**
- [x] `npm.cmd run test:run -- <focused gallery/editor/server test files>` from `parishweb`.
- [x] `npm.cmd run test:run` from `parishweb`.
- [x] `npm.cmd exec eslint -- <changed TypeScript files>` from `parishweb`.
- [x] `npm.cmd run build` from `parishweb` (blocked by four pre-existing unused symbols in `AdminOperationsPage.tsx`).

**Dependencies:** Tasks 2 and 3

**Files likely touched:**
- Tests and implementation files from Tasks 1-3, only if verification reveals a related defect.

**Estimated scope:** Small

## Checkpoint: Implementation complete; browser publish verification pending

- [ ] Acceptance criteria for Tasks 1-4 are satisfied.
- [x] Existing unrelated deployment plan and unrelated working-tree changes remain untouched.
