---
name: deploy
description: Ship Portée to GitHub Pages and confirm the live site serves the new build. Runs the tests and the build, pushes main, waits for the GitHub Actions run and checks the Pages deployment and the live URL. Use when the user wants the app online, to test the latest version on the phone, or says "déploie", "mets en ligne", "pousse", "sur mon tel".
---

Deploy Portée to https://said-kherif.github.io/portee/.

## Steps

1. `source ~/.nvm/nvm.sh && nvm use` in every shell command.
2. `npm test` then `npm run build`. Stop and report on any failure, nothing gets pushed.
3. `git status --short`. If tracked files are modified and the user did not ask for a commit, stop and list them: pushing only ships what is committed. If they asked, commit with a French message and the attribution trailer from the session instructions.
4. `git push origin main`. Never force-push from this skill.
5. Find the run of the pushed commit: `gh run list --branch main --limit 5 --json databaseId,headSha,status` and pick the one whose `headSha` is `git rev-parse HEAD`. Wait with `gh run watch <id> --exit-status`. If it fails, show the failing job with `gh run view <id> --log-failed | tail -40` and stop.
6. Confirm the deployment: `gh api "repos/Said-Kherif/portee/deployments?environment=github-pages&per_page=1" --jq '.[0].sha'` must equal `git rev-parse HEAD`. Then `curl -s -o /dev/null -w "%{http_code}" https://said-kherif.github.io/portee/` must return 200 and the page title must be `Portée`. Pages can lag a minute behind the deployment; retry the curl a few times before reporting a problem.
7. Reply with the URL on its own line and two reminders: the installed app picks up the new version on its next launch, when the service worker reloads once, and a hard refresh is not needed.
