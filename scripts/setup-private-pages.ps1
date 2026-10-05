# Sets up private-pages/, the private repository kept inside the project as a git submodule
# (documentation/access/spec.md §3). Run it once per clone; running it again changes nothing.
#
#   pwsh -File scripts/setup-private-pages.ps1
#
# It fetches the submodule (if this clone was made without --recurse-submodules), sets the two git
# settings that keep it in step, and puts it on its main branch: a submodule starts on a detached commit,
# and edits made there would be on no branch.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

git submodule update --init private-pages
if ($LASTEXITCODE) { throw "couldn't fetch private-pages: check that you can read prabinpebam/atiya-private" }

# a pull updates the submodule too; a push refuses a pointer to a private commit that isn't pushed
git config submodule.recurse true
git config push.recurseSubmodules check

Push-Location private-pages
try {
  git fetch --quiet origin main
  $branch = git symbolic-ref --quiet --short HEAD
  if ($branch -ne 'main') {
    # on main, at the commit the public repository points at (or ahead of it, if main has moved on)
    git switch --quiet main 2>$null
    if ($LASTEXITCODE) { git switch --quiet -c main --track origin/main }
  }
  git branch --quiet --set-upstream-to=origin/main main
  Write-Host "private-pages is on $(git symbolic-ref --short HEAD) at $(git rev-parse --short HEAD)."
} finally {
  Pop-Location
}
