# Runs the site's dev server (npm run dev) in its own Windows Terminal window, independent of VS Code
# and of any agent session: closing or restarting VS Code never stops it. Stop it by closing that window
# (or Ctrl+C in it). If the site is already being served on 4321, it says so and starts nothing.
#
#   pwsh -File scripts/serve.ps1
#
# Docs: AGENTS.md, "Commands" (this is what "run the site" means).

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$port = 4321
# localhost, never 127.0.0.1: YouTube won't play the articles' videos on a page served from an IP address
$url = "http://localhost:$port/"

$busy = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($busy) {
  $name = (Get-Process -Id $busy.OwningProcess -ErrorAction SilentlyContinue).ProcessName
  Write-Host "Port $port is already in use (process $($busy.OwningProcess), $name). If that's the site, it's running: $url"
  Write-Host "To restart it, close its terminal window (or stop that process) and run this again."
  exit 0
}

$title = 'Site dev server (localhost:4321)'
$command = 'npm run dev'
$wt = Get-Command wt.exe -ErrorAction SilentlyContinue
$shell = if (Get-Command pwsh.exe -ErrorAction SilentlyContinue) { 'pwsh.exe' } else { 'powershell.exe' }
if ($wt) {
  # a new Windows Terminal window: Windows Terminal runs on its own, outside VS Code's process tree
  Start-Process -FilePath $wt.Source -ArgumentList @('-w', 'new', 'new-tab', '--title', "`"$title`"", '--suppressApplicationTitle', '-d', "`"$root`"", $shell, '-NoLogo', '-NoExit', '-Command', $command)
} else {
  # no Windows Terminal: a console window of its own
  Start-Process -FilePath $shell -WorkingDirectory $root -ArgumentList @('-NoLogo', '-NoExit', '-Command', "`$Host.UI.RawUI.WindowTitle = '$title'; $command")
}

Write-Host "Starting the site in its own terminal window..."
$deadline = (Get-Date).AddSeconds(120)
while ((Get-Date) -lt $deadline) {
  try {
    $r = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 10
    if ($r.StatusCode -eq 200) {
      Write-Host "The site is running: $url (edit mode: ${url}_edit/)"
      exit 0
    }
  } catch {
    Start-Sleep -Seconds 2
  }
}
Write-Host "It didn't answer on $url within 2 minutes: look at its terminal window for the error."
exit 1
