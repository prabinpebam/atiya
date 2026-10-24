# Update the pinned agentic-craft and agent-orchestration kits and regenerate this repository's discovery files.
$ErrorActionPreference = 'Stop'
$kits = @('agentic-craft', 'agent-orchestration')
Push-Location (Split-Path -Parent $PSScriptRoot)
try {
  foreach ($kit in $kits) {
    git submodule update --init $kit
    if ($LASTEXITCODE -ne 0) { throw "Could not initialize $kit." }
    $changes = git -C $kit status --porcelain
    if ($LASTEXITCODE -ne 0) { throw "Could not inspect $kit." }
    if ($changes) { throw "$kit has local changes. Commit them upstream before updating." }
    git submodule update --remote $kit
    if ($LASTEXITCODE -ne 0) { throw "Could not fetch the latest $kit main commit." }
    Push-Location $kit
    try {
      node --test test/harness.test.mjs
      if ($LASTEXITCODE -ne 0) { throw "$kit's own tests failed." }
    } finally {
      Pop-Location
    }
  }
  node scripts\agent-kits.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Could not write the discovery files.' }
  node scripts\agent-kits.mjs --check
  if ($LASTEXITCODE -ne 0) { throw 'The discovery files check failed.' }
  Write-Host 'Agent kits updated. Review and commit the submodule pointers with .github/skills and .github/agents together.'
} finally {
  Pop-Location
}
