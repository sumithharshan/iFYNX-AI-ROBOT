param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$env:OLLAMA_HOST = '127.0.0.1:11434'
$env:OLLAMA_MODELS = Join-Path $PSScriptRoot 'runtime/models'
$env:OLLAMA_NO_CLOUD = '1'
$env:OLLAMA_CONTEXT_LENGTH = '4096'
$env:OLLAMA_NUM_PARALLEL = '1'
$env:OLLAMA_KEEP_ALIVE = '10m'
try { $null = Invoke-RestMethod 'http://127.0.0.1:11434/api/tags' -TimeoutSec 2 }
catch {
  if (!(Test-Path -LiteralPath './runtime/ollama.exe')) { throw 'Ollama runtime is missing from runtime/ollama.exe.' }
  Start-Process -FilePath (Join-Path $PSScriptRoot 'runtime/ollama.exe') -ArgumentList 'serve' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $PSScriptRoot 'runtime/ollama-out.log') -RedirectStandardError (Join-Path $PSScriptRoot 'runtime/ollama-error.log')
}
$available = $false
for ($i = 0; $i -lt 30; $i++) {
  try { $tags = Invoke-RestMethod 'http://127.0.0.1:11434/api/tags' -TimeoutSec 2; $available = $true; break } catch { Start-Sleep -Seconds 1 }
}
if (!$available) { throw 'Local AI did not start. See runtime/ollama-error.log.' }
if (!($tags.models | Where-Object { $_.name -eq 'qwen3:4b' })) {
  Write-Host 'Downloading Buddy model (approximately 2.5 GB, first start only)...'
  & './runtime/ollama.exe' pull qwen3:4b
  if ($LASTEXITCODE -ne 0) { throw 'Model download failed. Run Start Buddy again to resume.' }
}
try { $null = Invoke-RestMethod 'http://127.0.0.1:3210/api/status' -TimeoutSec 2 }
catch {
  $nodePath = (Get-Command node.exe -ErrorAction Stop).Source
  Start-Process -FilePath $nodePath -ArgumentList 'server.mjs' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $PSScriptRoot 'runtime/buddy-out.log') -RedirectStandardError (Join-Path $PSScriptRoot 'runtime/buddy-error.log')
}
$appReady = $false
for ($i = 0; $i -lt 15; $i++) {
  try { $null = Invoke-RestMethod 'http://127.0.0.1:3210/api/status' -TimeoutSec 2; $appReady = $true; break } catch { Start-Sleep -Seconds 1 }
}
if (!$appReady) { throw 'Buddy did not start. See runtime/buddy-error.log.' }
if (!$NoBrowser) { Start-Process 'http://127.0.0.1:3210' }
Write-Host 'Buddy is open in your browser. Local services run in the background.'
