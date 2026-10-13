# Update the pinned upstream Slate package and regenerate this host's documentation runtime.
$ErrorActionPreference = 'Stop'
Push-Location (Split-Path -Parent $PSScriptRoot)
try {
  git submodule update --init slate
  if ($LASTEXITCODE -ne 0) { throw 'Could not initialize Slate.' }
  $changes = git -C slate status --porcelain
  if ($LASTEXITCODE -ne 0) { throw 'Could not inspect Slate.' }
  if ($changes) { throw 'Slate has local changes. Commit them upstream before updating.' }
  git submodule update --remote slate
  if ($LASTEXITCODE -ne 0) { throw 'Could not fetch the latest Slate main commit.' }
  node slate\scripts\runtime-host.mjs sync --repo . --host documentation
  if ($LASTEXITCODE -ne 0) { throw 'Could not synchronize the documentation runtime.' }
  node slate\scripts\runtime-host.mjs check --repo . --host documentation
  if ($LASTEXITCODE -ne 0) { throw 'The documentation runtime check failed.' }
  Write-Host 'Slate updated. Review and commit slate, documentation/shell, and documentation/.slate-runtime.json together.'
} finally {
  Pop-Location
}
