@echo off
REM Atualiza a configuração da nuvem (Supabase) a partir do arquivo .env
cd /d "%~dp0"
node scripts\atualizar-env.js
pause
