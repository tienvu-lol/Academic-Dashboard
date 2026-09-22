# Current Work
## Objective
Move dashboard screenshots to a version-controlled folder so they render correctly on GitHub.

## Scope
### In Scope
- Create `docs/assets/` folder.
- Copy needed screenshots from the gitignored `artifacts/` folder to `docs/assets/`.
- Update `README.md` links to point to `docs/assets/`.

### Out of Scope
- Taking new screenshots.

## Current Repository State
- Active branch: `main` (user switched branches)
- Images moved to `docs/assets/` and are now tracked.

## TODO
- [x] Read AGENTS.md, CURRENT_WORK.md, inspect git status.
- [x] Update CURRENT_WORK.md BEFORE writing any code.
- [x] Copy images to `docs/assets/`.
- [x] Update links in `README.md`.
- [x] Run verification (Git status confirms `docs/assets/` is untracked and not ignored).
- [x] Update CURRENT_WORK.md before ending the session.

## Expected Files Touched
- `README.md`
- `docs/assets/*` (new images)

## Acceptance Criteria
- [x] Images are tracked in git (not ignored).
- [x] `README.md` uses the new image paths.

## Implementation Notes
- Created `docs/assets/` and copied the images over.
- Re-ran the text replacement on the newly checked out `main` branch `README.md`.

## Verification
- Ran `git status` which confirmed `docs/assets/` is ready to be staged (unlike `artifacts/`).

## Completed This Session
- Copied images to a trackable folder.
- Inserted images directly into the `main` branch's `README.md`.

## Remaining Work
- None.

## Known Regressions / Risks
- None.

## Exact Next Action
- Wait for user.

## Handoff Summary
- Images successfully moved to `docs/assets/` and the `README.md` is updated.
