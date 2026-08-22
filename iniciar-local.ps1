param([switch]$ActualizarDatos)
$ErrorActionPreference = 'Stop'
$project = $PSScriptRoot
$dataDir = Join-Path $project 'local-data'
$snapshot = Join-Path $dataDir 'admin-snapshot.json'
$url = 'https://amlweohcbadjdqscoajp.supabase.co'
$key = 'sb_publishable_EhpzIT3LJVEWkjfG3wQ9Ew_G1og6EiC'
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
if ($ActualizarDatos -or -not (Test-Path -LiteralPath $snapshot)) {
  Write-Host 'Creando la copia privada desde Supabase...' -ForegroundColor Cyan
  $email = Read-Host 'Correo de acceso a la matriz'
  $securePassword = Read-Host 'Contraseña' -AsSecureString
  $password = [System.Net.NetworkCredential]::new('', $securePassword).Password
  try {
    $loginBody = @{ email = $email; password = $password } | ConvertTo-Json
    $login = Invoke-RestMethod -Method Post -Uri "$url/auth/v1/token?grant_type=password" -Headers @{ apikey = $key } -ContentType 'application/json' -Body $loginBody
    $headers = @{ apikey = $key; Authorization = "Bearer $($login.access_token)" }
    $summary = Invoke-RestMethod -Method Post -Uri "$url/rest/v1/rpc/admin_resumen" -Headers $headers -ContentType 'application/json' -Body '{}'
    $detail = Invoke-RestMethod -Method Post -Uri "$url/rest/v1/rpc/admin_plantilla_detalle" -Headers $headers -ContentType 'application/json' -Body '{}'
    $details = @{}; foreach ($item in $detail) { $details[[string]$item.empleado_id] = $item }
    $merged = foreach ($employee in $summary.empleados) { $copy = [ordered]@{}; foreach ($property in $employee.PSObject.Properties) { $copy[$property.Name] = $property.Value }; $extra = $details[[string]$employee.id]; if ($extra) { foreach ($property in $extra.PSObject.Properties) { $copy[$property.Name] = $property.Value } }; [pscustomobject]$copy }
    $summary.empleados = @($merged)
    $summary | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $snapshot -Encoding utf8
    Write-Host "Copia lista: $($summary.empleados.Count) empleados." -ForegroundColor Green
  } finally { $password = $null; $securePassword = $null; $login = $null }
} else { Write-Host 'Usando la copia privada que ya existe en esta computadora.' -ForegroundColor Green }
Write-Host 'Abriendo la página local en http://127.0.0.1:4173/' -ForegroundColor Cyan
Start-Process 'http://127.0.0.1:4173/'
$existingServer = Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue
if ($existingServer) { Write-Host 'El servidor local ya está activo.' -ForegroundColor Green; exit 0 }
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodeExe = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
if (-not (Test-Path -LiteralPath $nodeExe)) { throw 'No se encontró Node.js para iniciar la página local.' }
& $nodeExe (Join-Path $project 'tools/local-server.mjs')
