# GPS Position API send test (PowerShell)
#
# Usage:
#   .\scripts\send-position.ps1
#   .\scripts\send-position.ps1 -Count 10 -IntervalSeconds 2
#   .\scripts\send-position.ps1 -Mode owntracks
#   .\scripts\send-position.ps1 -Email walker@example.com -Latitude 34.6805 -Longitude 134.9072
#
# Requires: npm run dev, seeded users (npm run db:seed:local)

param(
    [string] $BaseUrl = "http://127.0.0.1:8787",
    [string] $Email = "walker@example.com",
    [string] $Password = "password",
    [ValidateSet("positions", "owntracks")]
    [string] $Mode = "positions",
    [double] $Latitude = 35.681236,
    [double] $Longitude = 139.767125,
    [double] $Accuracy = 10,
    [int] $Count = 1,
    [double] $IntervalSeconds = 1,
    [double] $StepDegrees = 0.00015
)

$ErrorActionPreference = "Stop"

function Write-Step([string] $Message) {
    Write-Host $Message -ForegroundColor Cyan
}

function Write-Ok([string] $Message) {
    Write-Host $Message -ForegroundColor Green
}

function Write-Fail([string] $Message) {
    Write-Host $Message -ForegroundColor Red
}

function Invoke-ApiJson {
    param(
        [string] $Method,
        [string] $Url,
        [hashtable] $Headers = @{},
        [object] $Body = $null
    )

    $params = @{
        Method      = $Method
        Uri         = $Url
        Headers     = $Headers
        ContentType = "application/json; charset=utf-8"
    }

    if ($null -ne $Body) {
        $params.Body = ($Body | ConvertTo-Json -Compress -Depth 6)
    }

    return Invoke-RestMethod @params
}

Write-Step "Base URL: $BaseUrl"
Write-Step "Mode: $Mode / User: $Email / Count: $Count"

if ($Mode -eq "positions") {
    Write-Step "Logging in..."
    $login = Invoke-ApiJson -Method Post -Url "$BaseUrl/api/login" -Body @{
        email       = $Email
        password    = $Password
        device_name = "send-position-script"
    }

    if (-not $login.token) {
        Write-Fail "Login failed (no token)"
        exit 1
    }

    Write-Ok "Login OK: $($login.user.name) (id=$($login.user.id))"
    $authHeaders = @{ Authorization = "Bearer $($login.token)" }

    for ($i = 0; $i -lt $Count; $i++) {
        $lat = $Latitude + ($i * $StepDegrees)
        $lon = $Longitude + ($i * $StepDegrees * 0.7)
        $recordedAt = (Get-Date).ToUniversalTime().ToString("o")

        $payload = @{
            latitude    = [math]::Round($lat, 7)
            longitude   = [math]::Round($lon, 7)
            accuracy    = $Accuracy
            recorded_at = $recordedAt
        }

        Write-Step "[$($i + 1)/$Count] POST /api/positions lat=$($payload.latitude) lon=$($payload.longitude)"
        $response = Invoke-ApiJson -Method Post -Url "$BaseUrl/api/positions" -Headers $authHeaders -Body $payload
        Write-Ok "  => 201 user_id=$($response.data.user_id) recorded_at=$($response.data.recorded_at)"

        if ($i -lt $Count - 1 -and $IntervalSeconds -gt 0) {
            Start-Sleep -Seconds $IntervalSeconds
        }
    }
}
else {
    $pair = "${Email}:${Password}"
    $basic = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($pair))
    $authHeaders = @{ Authorization = "Basic $basic" }

    for ($i = 0; $i -lt $Count; $i++) {
        $lat = $Latitude + ($i * $StepDegrees)
        $lon = $Longitude + ($i * $StepDegrees * 0.7)
        $tst = [int]([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())

        $payload = @{
            _type = "location"
            lat   = [math]::Round($lat, 7)
            lon   = [math]::Round($lon, 7)
            acc   = $Accuracy
            tst   = $tst
        }

        Write-Step "[$($i + 1)/$Count] POST /api/owntracks lat=$($payload.lat) lon=$($payload.lon)"
        $response = Invoke-ApiJson -Method Post -Url "$BaseUrl/api/owntracks" -Headers $authHeaders -Body $payload
        Write-Ok "  => 200 $($response | ConvertTo-Json -Compress)"

        if ($i -lt $Count - 1 -and $IntervalSeconds -gt 0) {
            Start-Sleep -Seconds $IntervalSeconds
        }
    }
}

Write-Ok "Done. Check the map at http://localhost:8080/map"
