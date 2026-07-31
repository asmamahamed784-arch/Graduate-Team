param(
  [string]$DatabaseName = "nqs",
  [string]$PostgresUser = "postgres",
  [string]$HostName = "localhost"
)

$ErrorActionPreference = "Stop"

$installRoot = "C:\Program Files\PostgreSQL"
$pgInstall = Get-ChildItem $installRoot -Directory -ErrorAction SilentlyContinue |
  Sort-Object Name -Descending |
  Select-Object -First 1

if (-not $pgInstall) {
  throw "PostgreSQL installation was not found under $installRoot."
}

$pgBin = Join-Path $pgInstall.FullName "bin"
$pgData = Join-Path $pgInstall.FullName "data"
$psql = Join-Path $pgBin "psql.exe"
$createdb = Join-Path $pgBin "createdb.exe"
$pgCtl = Join-Path $pgBin "pg_ctl.exe"

if (-not (Test-Path $psql)) { throw "psql.exe was not found at $psql." }
if (-not (Test-Path $createdb)) { throw "createdb.exe was not found at $createdb." }

Write-Host "Using PostgreSQL: $($pgInstall.FullName)"

try {
  & $pgCtl status -D $pgData | Out-Null
} catch {
  Write-Host "PostgreSQL server is not running. Starting local server..."
  & $pgCtl start -D $pgData -l (Join-Path $pgData "server.log")
}

$securePassword = Read-Host "Enter PostgreSQL password for user '$PostgresUser'" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
$plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

try {
  $env:PGPASSWORD = $plainPassword

  Write-Host "Checking PostgreSQL connection..."
  & $psql -U $PostgresUser -h $HostName -d postgres -c "SELECT current_user;" | Out-Host

  $exists = & $psql -U $PostgresUser -h $HostName -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$DatabaseName';"

  if ($exists.Trim() -eq "1") {
    Write-Host "Database '$DatabaseName' already exists."
  } else {
    Write-Host "Creating database '$DatabaseName'..."
    & $createdb -U $PostgresUser -h $HostName $DatabaseName
  }

  Write-Host ""
  Write-Host "PostgreSQL database '$DatabaseName' is ready."
  Write-Host "Future backend DATABASE_URL:"
  Write-Host "DATABASE_URL=postgresql://${PostgresUser}:<PASSWORD>@${HostName}:5432/$DatabaseName"
  Write-Host "Run 'node backend/utils/seed.js' from the repository root to create the NQS document tables and seed data."
} finally {
  Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}
