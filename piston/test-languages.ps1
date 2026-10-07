$base = "http://localhost:2000/api/v2"

$tests = @(
    @{ lang = "javascript"; file = "main.js"; code = @'
console.log("hello from javascript");
'@ },
    @{ lang = "typescript"; file = "main.ts"; code = @'
const msg: string = "hello from typescript";
console.log(msg);
'@ },
    @{ lang = "python"; file = "main.py"; code = @'
print("hello from python")
'@ },
    @{ lang = "java"; file = "Main.java"; code = @'
public class Main {
    public static void main(String[] args) {
        System.out.println("hello from java");
    }
}
'@ },
    @{ lang = "c"; file = "main.c"; code = @'
#include <stdio.h>
int main(void) { printf("hello from c\n"); return 0; }
'@ },
    @{ lang = "c++"; file = "main.cpp"; code = @'
#include <iostream>
int main() { std::cout << "hello from c++" << std::endl; return 0; }
'@ },
    @{ lang = "csharp"; file = "main.cs"; code = @'
using System;
class Program { static void Main() { Console.WriteLine("hello from csharp"); } }
'@ },
    @{ lang = "go"; file = "main.go"; code = @'
package main
import "fmt"
func main() { fmt.Println("hello from go") }
'@ },
    @{ lang = "rust"; file = "main.rs"; code = @'
fn main() { println!("hello from rust"); }
'@ },
    @{ lang = "php"; file = "main.php"; code = @'
<?php echo "hello from php\n";
'@ },
    @{ lang = "ruby"; file = "main.rb"; code = @'
puts "hello from ruby"
'@ }
)

foreach ($t in $tests) {
    $body = @{
        language = $t.lang
        version  = "*"
        files    = @(@{ name = $t.file; content = $t.code })
    } | ConvertTo-Json -Depth 6

    try {
        $r = Invoke-RestMethod -Method Post -Uri "$base/execute" -ContentType "application/json" -Body $body -TimeoutSec 120
    } catch {
        $msg = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }
        Write-Host ("{0,-11} FAIL  request rejected: {1}" -f $t.lang, $msg) -ForegroundColor Red
        continue
    }

    $compileFailed = $r.compile -and $r.compile.code -ne 0
    $stage = if ($compileFailed) { $r.compile } else { $r.run }
    $stageName = if ($compileFailed) { "compile" } else { "run" }

    if (-not $compileFailed -and $r.run.code -eq 0) {
        Write-Host ("{0,-11} OK    {1}" -f $t.lang, $r.run.stdout.Trim()) -ForegroundColor Green
    } else {
        Write-Host ("{0,-11} FAIL  stage={1} exit={2} signal={3} status={4}" -f $t.lang, $stageName, $stage.code, $stage.signal, $stage.status) -ForegroundColor Red
        if ($stage.message) { Write-Host "            message: $($stage.message)" }
        if ($stage.stderr)  { Write-Host "            stderr:  $($stage.stderr.Trim())" }
        if ($stage.stdout)  { Write-Host "            stdout:  $($stage.stdout.Trim())" }
    }
}