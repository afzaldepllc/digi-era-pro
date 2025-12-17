# Quick Real-time Setup and Verification Script
Write-Host "`n🚀 Supabase Real-time Setup Helper`n" -ForegroundColor Cyan

# Step 1: Check environment variables
Write-Host "1️⃣ Checking environment variables..." -ForegroundColor Yellow
$envFile = ".env.local"
if (Test-Path $envFile) {
    $supabaseUrl = Select-String -Path $envFile -Pattern "NEXT_PUBLIC_SUPABASE_URL" | Select-Object -First 1
    $supabaseKey = Select-String -Path $envFile -Pattern "NEXT_PUBLIC_SUPABASE_ANON_KEY" | Select-Object -First 1
    
    if ($supabaseUrl -and $supabaseKey) {
        Write-Host "   ✅ Supabase environment variables found`n" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Missing Supabase environment variables in .env.local`n" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "   ❌ .env.local file not found`n" -ForegroundColor Red
    exit 1
}

# Step 2: Copy SQL script to clipboard
Write-Host "2️⃣ Copying SQL script to clipboard..." -ForegroundColor Yellow
$sqlFile = "scripts\setup-supabase-realtime.sql"
if (Test-Path $sqlFile) {
    Get-Content $sqlFile | Set-Clipboard
    Write-Host "   ✅ SQL script copied to clipboard!`n" -ForegroundColor Green
} else {
    Write-Host "   ❌ SQL script not found at $sqlFile`n" -ForegroundColor Red
    exit 1
}

# Step 3: Instructions
Write-Host "`n📋 NEXT STEPS:`n" -ForegroundColor Cyan
Write-Host "1. Opening Supabase SQL Editor in your browser..." -ForegroundColor White
Write-Host "2. The SQL script is already in your clipboard" -ForegroundColor White
Write-Host "3. Paste (Ctrl+V) in the SQL Editor" -ForegroundColor White
Write-Host "4. Click 'Run' button`n" -ForegroundColor White

# Step 4: Open Supabase Dashboard
Write-Host "🌐 Opening Supabase Dashboard..." -ForegroundColor Yellow
Start-Process "https://app.supabase.com/project/mifxampcsrojspuhtlpy/sql"
Start-Sleep -Seconds 2

# Step 5: Wait for user confirmation
Write-Host "`n⏳ After running the SQL in Supabase:" -ForegroundColor Yellow
Write-Host "   1. You should see output with 'rowsecurity = f' for all tables" -ForegroundColor White
Write-Host "   2. Press any key here to continue with testing...`n" -ForegroundColor White
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Step 6: Test realtime connection
Write-Host "`n3️⃣ Testing Realtime connection...`n" -ForegroundColor Yellow
Write-Host "Running test script..." -ForegroundColor White
npx tsx scripts/test-realtime.ts

# Step 7: Final instructions
Write-Host "`n`n✅ Setup Complete!`n" -ForegroundColor Green
Write-Host "📋 Final Steps:" -ForegroundColor Cyan
Write-Host "1. Restart your dev server (Ctrl+C then 'npm run dev')" -ForegroundColor White
Write-Host "2. Open app in two different browsers" -ForegroundColor White
Write-Host "3. Send a message from one - it should appear instantly in the other!`n" -ForegroundColor White

Write-Host "🔍 Check console for these logs:" -ForegroundColor Cyan
Write-Host "   ✅ Successfully subscribed to channel" -ForegroundColor White
Write-Host "   🔔 Realtime: New message detected" -ForegroundColor White
Write-Host "   📩 onNewMessage handler called`n" -ForegroundColor White

Write-Host "📖 For troubleshooting, see: REALTIME_NOT_WORKING_FIX.md`n" -ForegroundColor Yellow
