# Update the AI integration pin, run its offline checks, and regenerate the thin discovery adapter.
$ErrorActionPreference = 'Stop'
Push-Location (Split-Path -Parent $PSScriptRoot)
try {
  if (-not (Test-Path 'ai-integration\.git')) {
    git submodule update --init -- ai-integration
    if ($LASTEXITCODE -ne 0) { throw 'Could not initialize AI integration.' }
  }
  $changes = git -C ai-integration status --porcelain
  if ($LASTEXITCODE -ne 0) { throw 'Could not inspect AI integration.' }
  if ($changes) { throw 'AI integration has local changes. Preserve them upstream before updating.' }
  git -C ai-integration fetch origin main
  if ($LASTEXITCODE -ne 0) { throw 'Could not fetch AI integration main.' }
  git -C ai-integration merge-base --is-ancestor HEAD origin/main
  if ($LASTEXITCODE -ne 0) { throw 'AI integration has diverged from upstream main. Review it before updating.' }
  git -C ai-integration checkout --detach origin/main
  if ($LASTEXITCODE -ne 0) { throw 'Could not update the AI integration checkout.' }
  Push-Location ai-integration
  try {
    node --test
    if ($LASTEXITCODE -ne 0) { throw 'AI integration offline tests failed.' }
    node skills\ai-integration\scripts\ai.mjs catalogue validate
    if ($LASTEXITCODE -ne 0) { throw 'AI integration catalogue validation failed.' }
  } finally { Pop-Location }
  node scripts\agent-kits.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Could not regenerate discovery files.' }
  node scripts\agent-kits.mjs --check
  if ($LASTEXITCODE -ne 0) { throw 'Discovery files are stale.' }
  Write-Host 'AI integration updated. Review and commit its pin with the generated adapter. Nothing was pushed.'
} finally { Pop-Location }
