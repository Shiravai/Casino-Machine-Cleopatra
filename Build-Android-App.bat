@echo off
title Cleopatra's Gold - Build Android App
cd /d "%~dp0"

echo.
echo  ============================================
echo   Building the Android app (APK)
echo  ============================================
echo.

set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"

echo  [1/3] Copying game files into www\ ...
xcopy /y /q index.html www\ >nul
xcopy /y /q script.js www\ >nul
xcopy /y /q styles.css www\ >nul
xcopy /y /q manifest.webmanifest www\ >nul
xcopy /y /q /e /i assets www\assets >nul

echo  [2/3] Syncing Capacitor project ...
call npx cap sync android
if errorlevel 1 goto :error

echo  [3/3] Building APK with Gradle (this can take a few minutes) ...
cd android
call gradlew.bat assembleDebug
if errorlevel 1 goto :buildfail
cd ..

copy /y "android\app\build\outputs\apk\debug\app-debug.apk" "CleopatrasGold.apk" >nul

echo.
echo  ============================================
echo   DONE! CleopatrasGold.apk was updated.
echo   Run Play-On-Phone.bat to send it to your phone.
echo  ============================================
echo.
pause
exit /b 0

:buildfail
cd ..
:error
echo.
echo  Build failed - scroll up to see the error.
echo.
pause
exit /b 1
