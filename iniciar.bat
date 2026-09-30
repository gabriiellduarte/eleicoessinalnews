@echo off
rem Inicia o servidor da apuracao e abre a pagina no navegador.
rem Deixe esta janela aberta enquanto o site estiver no ar.
cd /d "%~dp0"
start "" "http://localhost:3000/"
node server.js
pause
