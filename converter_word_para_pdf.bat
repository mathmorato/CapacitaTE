@echo off
chcp 65001 > nul
title Conversor Word para PDF - AutoReport CECATE
echo ==============================================================================
echo   AutoReport CECATE - Conversor Automatico de Word (.docx) para PDF Oficial
echo   Centro Colaborador de Apoio ao Transporte Escolar - UFG / FNDE
echo ==============================================================================
echo.
echo Convertendo relatorios Word em PDF via motor oficial do Microsoft Word...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0converter_word_para_pdf.ps1" %*
echo.
echo ==============================================================================
echo Processo finalizado. Pressione qualquer tecla para fechar esta janela...
pause > nul
