<#
.SYNOPSIS
  Provisions and publishes the contact form's service (documentation/contact/spec.md §4, §8; plan C4).

.DESCRIPTION
  Creates whatever is missing, in the given subscription only (never the CLI's default): a resource group,
  a storage account (the Function app's, and the tables behind the rate limits), a Function app on Flex
  Consumption (Node.js 22), an Email Communication Service with an Azure-managed domain, and a Communication
  Service linked to it. Sets the app's settings (generating CONTACT_SECRET the first time, keeping it after)
  and its CORS origins, publishes contact-api/ with its production packages installed here (Azure can't
  reach the package feed the lockfile names), checks the challenge answers, and writes the endpoint to the
  site's .env. It never prints a secret.

  Run again at any time: it changes only what differs.

.EXAMPLE
  pwsh -File scripts/deploy-contact-api.ps1 -To you@example.com
#>
param(
  # Where messages go. Needed the first time; later runs keep the app's current value.
  [string]$To,
  [string]$Subscription = 'Visual Studio Enterprise Subscription',
  [string]$ResourceGroup = 'rg-atiya-contact',
  [string]$Location = 'centralindia',
  [string]$DataLocation = 'India',
  [string[]]$Origins = @('https://prabinpebam.github.io', 'http://localhost:4321'),
  # Only publish the code (the resources and settings already exist).
  [switch]$CodeOnly
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$api = Join-Path $root 'contact-api'

function Invoke-Az {
  # every call names the subscription; the output is JSON (or nothing), and a failure stops the script
  $out = & az @args --subscription $Subscription --only-show-errors 2>&1
  if ($LASTEXITCODE -ne 0) { throw "az $($args[0..2] -join ' ') failed: $out" }
  return $out
}
function AzJson { $o = Invoke-Az @args -o json; if ($o) { return ($o | Out-String | ConvertFrom-Json) } }
function Exists { & az @args --subscription $Subscription --only-show-errors -o none 2>$null; return $LASTEXITCODE -eq 0 }

$subId = (AzJson account show --query id)
# names that must be unique in Azure take a short, stable suffix from the subscription
$suffix = ([BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes("$subId/$ResourceGroup"))) -replace '-', '').Substring(0, 6).ToLower()
$storage = "atiyacontact$suffix"
$app = "atiya-contact-$suffix"
$emailService = "atiya-contact-email-$suffix"
$acs = "atiya-contact-acs-$suffix"
Write-Host "Subscription: $Subscription; resource group: $ResourceGroup ($Location)"

if (-not $CodeOnly) {
  & az extension show --name communication -o none 2>$null
  if ($LASTEXITCODE -ne 0) { & az extension add --name communication --only-show-errors | Out-Null }

  if (-not (Exists group show -n $ResourceGroup)) { Invoke-Az group create -n $ResourceGroup -l $Location -o none | Out-Null; Write-Host "Created the resource group" }

  if (-not (Exists storage account show -n $storage -g $ResourceGroup)) {
    Invoke-Az storage account create -n $storage -g $ResourceGroup -l $Location --sku Standard_LRS --kind StorageV2 --min-tls-version TLS1_2 --allow-blob-public-access false -o none | Out-Null
    Write-Host "Created the storage account"
  }

  if (-not (Exists functionapp show -n $app -g $ResourceGroup)) {
    Invoke-Az functionapp create -n $app -g $ResourceGroup --storage-account $storage --flexconsumption-location $Location --runtime node --runtime-version 22 --instance-memory 2048 -o none | Out-Null
    Write-Host "Created the Function app"
  }

  if (-not (Exists communication email show -n $emailService -g $ResourceGroup)) {
    Invoke-Az communication email create -n $emailService -g $ResourceGroup --location global --data-location $DataLocation -o none | Out-Null
    Write-Host "Created the email service"
  }
  if (-not (Exists communication email domain show --domain-name AzureManagedDomain --email-service-name $emailService -g $ResourceGroup)) {
    Invoke-Az communication email domain create --domain-name AzureManagedDomain --email-service-name $emailService -g $ResourceGroup --location global --domain-management AzureManaged -o none | Out-Null
    Write-Host "Created the Azure-managed email domain"
  }
  $domain = AzJson communication email domain show --domain-name AzureManagedDomain --email-service-name $emailService -g $ResourceGroup
  & az communication email domain sender-username update --sender-username DoNotReply --display-name "Prabin's site" --domain-name AzureManagedDomain --email-service-name $emailService -g $ResourceGroup --subscription $Subscription --only-show-errors -o none 2>$null

  if (-not (Exists communication show -n $acs -g $ResourceGroup)) {
    Invoke-Az communication create -n $acs -g $ResourceGroup --location global --data-location $DataLocation --linked-domains $domain.id -o none | Out-Null
    Write-Host "Created the communication service, linked to the domain"
  } else {
    Invoke-Az communication update -n $acs -g $ResourceGroup --linked-domains $domain.id -o none | Out-Null
  }

  # the settings: secrets go straight from Azure into the app, never to the screen
  $current = @{}
  foreach ($s in (AzJson functionapp config appsettings list -n $app -g $ResourceGroup)) { $current[$s.name] = $s.value }
  $to = if ($To) { $To } else { $current['CONTACT_TO'] }
  if (-not $to) { throw 'Give -To (where messages go) on the first run.' }
  $secret = if ($current['CONTACT_SECRET']) { $current['CONTACT_SECRET'] } else { [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)) }
  $acsConn = (Invoke-Az communication list-key -n $acs -g $ResourceGroup --query primaryConnectionString -o tsv | Out-String).Trim()
  $tableConn = (Invoke-Az storage account show-connection-string -n $storage -g $ResourceGroup --query connectionString -o tsv | Out-String).Trim()
  $settings = @(
    "CONTACT_TO=$to",
    "CONTACT_FROM=DoNotReply@$($domain.mailFromSenderDomain)",
    "ACS_CONNECTION_STRING=$acsConn",
    "RATE_TABLE_CONNECTION=$tableConn",
    "CONTACT_SECRET=$secret",
    "ALLOWED_ORIGINS=$($Origins -join ',')"
  )
  Invoke-Az functionapp config appsettings set -n $app -g $ResourceGroup --settings @settings -o none | Out-Null
  Write-Host "Set the app's settings (values not shown)"

  $cors = AzJson functionapp cors show -n $app -g $ResourceGroup
  $missing = $Origins | Where-Object { $cors.allowedOrigins -notcontains $_ }
  if ($missing) { Invoke-Az functionapp cors add -n $app -g $ResourceGroup --allowed-origins @missing -o none | Out-Null }
  $extra = $cors.allowedOrigins | Where-Object { $Origins -notcontains $_ }
  if ($extra) { Invoke-Az functionapp cors remove -n $app -g $ResourceGroup --allowed-origins @extra -o none | Out-Null }
  Write-Host "CORS allows: $($Origins -join ', ')"
}

# publish: the code with its production packages, installed here
$stage = Join-Path ([IO.Path]::GetTempPath()) "contact-api-$suffix"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory $stage | Out-Null
Copy-Item (Join-Path $api 'host.json'), (Join-Path $api 'package.json'), (Join-Path $api 'package-lock.json') $stage
Copy-Item (Join-Path $api 'src') (Join-Path $stage 'src') -Recurse
Push-Location $stage
try {
  & npm ci --omit=dev --no-audit --no-fund 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
} finally { Pop-Location }
$zip = Join-Path ([IO.Path]::GetTempPath()) "contact-api-$suffix.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip
Invoke-Az functionapp deployment source config-zip -n $app -g $ResourceGroup --src $zip --build-remote false -o none | Out-Null
Remove-Item $stage -Recurse -Force; Remove-Item $zip -Force
Write-Host 'Published contact-api'

# the endpoint, checked, and written to the site's .env (an address, not a secret)
# Flex Consumption reports it under properties; other plans at the top
$host_ = (AzJson functionapp show -n $app -g $ResourceGroup --query "properties.defaultHostName || defaultHostName")
$endpoint = "https://$host_"
$ok = $false
for ($i = 0; $i -lt 12 -and -not $ok; $i++) {
  try {
    $r = Invoke-WebRequest -UseBasicParsing "$endpoint/api/contact/challenge" -Headers @{ Origin = $Origins[0] } -TimeoutSec 30
    $ok = $r.StatusCode -eq 200 -and ($r.Content | ConvertFrom-Json).difficulty -gt 0
  } catch { Start-Sleep -Seconds 10 }
}
if (-not $ok) { throw "The service didn't answer at $endpoint/api/contact/challenge" }
$envFile = Join-Path $root '.env'
$line = "PUBLIC_CONTACT_ENDPOINT=$endpoint"
$lines = if (Test-Path $envFile) { @(Get-Content $envFile | Where-Object { $_ -notmatch '^PUBLIC_CONTACT_ENDPOINT=' }) } else { @('# the contact form''s service (documentation/contact/spec.md §4.4): an address, not a secret') }
Set-Content -Path $envFile -Value (@($lines) + $line) -Encoding utf8
Write-Host "The service answers at $endpoint; .env updated"
