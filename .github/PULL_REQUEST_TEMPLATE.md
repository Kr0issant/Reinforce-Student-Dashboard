## What does this change?

<!-- One or two sentences. What is different after this merges? -->

## Why?

<!-- Link the issue if there is one: Closes #123 -->

## How did you test it?

<!-- Be specific. "Ran it locally" is not a test.
     What did you click, what did you expect, what did you see?
     Say what you did NOT test — that is more useful than pretending. -->

## Screenshots

<!-- Required for any visual change. Before and after if you changed something existing. -->

---

## Checklist

- [ ] I read my own diff line by line before opening this
- [ ] `npm run build` and `npm run lint` pass
- [ ] The backend starts without errors
- [ ] No secrets, `.env` files, or service account keys in the diff
- [ ] No debug logging, commented-out code, or placeholder content left behind
- [ ] No invented or hardcoded sample data rendered as if it were real
- [ ] Commits are signed and authored under my own identity
- [ ] This PR has one purpose — unrelated fixes are in their own issue

## Blast radius

- [ ] Touches authentication, sessions, or permissions
- [ ] Touches a Firestore collection, field name, or document shape
- [ ] Changes an API request or response shape
- [ ] Touches the `/auth` route the Discord bot deep-links to
- [ ] Adds or removes a dependency
- [ ] Touches CI, `vercel.json`, or environment variables

> Any box ticked above needs a second reviewer, and if it touches Firestore or
> `/auth`, a coordinated change in [`Reinforce-SST/YUVI`](https://github.com/Reinforce-SST/YUVI).
> See [`docs/DATA_CONTRACT.md`](../docs/DATA_CONTRACT.md).
