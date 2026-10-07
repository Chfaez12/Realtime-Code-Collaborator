$base = "http://localhost:2000/api/v2"

# Piston package names (a package can cover several languages: gcc = C and C++, mono = C#)
$wanted = @("python", "node", "typescript", "java", "gcc", "mono", "go", "rust", "php", "ruby")

$available = Invoke-RestMethod "$base/packages"

foreach ($name in $wanted) {
    $candidates = $available | Where-Object { $_.language -eq $name }
    if (-not $candidates) {
        Write-Warning "No package named '$name'. List the real names with: Invoke-RestMethod $base/packages | Select-Object -ExpandProperty language -Unique"
        continue
    }

    $latest = $candidates | Sort-Object {
        try { [version]$_.language_version } catch { [version]"0.0" }
    } | Select-Object -Last 1

    if ($latest.installed) {
        Write-Host "$name $($latest.language_version) is already installed"
        continue
    }

    Write-Host "Installing $name $($latest.language_version) (this can take a few minutes)..."
    $body = @{ language = $name; version = $latest.language_version } | ConvertTo-Json
    try {
        Invoke-RestMethod -Method Post -Uri "$base/packages" -ContentType "application/json" -Body $body -TimeoutSec 1800 | Out-Null
        Write-Host "  done"
    } catch {
        Write-Warning "  failed: $($_.Exception.Message)"
    }
}

Write-Host "`nInstalled runtimes:"
Invoke-RestMethod "$base/runtimes" | Select-Object language, version | Format-Table