@echo off
REM Piloto no PC: gera as telas e liga o sistema inteiro na porta 4000 (telas, API e arquivos).
REM O banco continua no Neon (backend\.env). Fechar esta janela desliga o sistema para todos.
title Prumo - piloto
cd /d "%~dp0..\.."

if not exist backend\.env (
  echo Falta o arquivo backend\.env com a conexao do banco.
  goto fim
)

echo Gerando as telas...
pushd frontend
if not exist node_modules call npm install
call npm run build:piloto
if errorlevel 1 (
  popd
  echo Falha ao gerar as telas. Veja a mensagem acima.
  goto fim
)
popd

pushd backend
if not exist node_modules call npm install
echo.
echo ============================================================
echo  Sistema ligando. Os usuarios acessam por um destes enderecos:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do for /f "tokens=*" %%b in ("%%a") do echo    http://%%b:4000
echo  Nao feche esta janela: fechar desliga o sistema.
echo ============================================================
echo.
set SERVE_FRONTEND=true
call npm start
popd

:fim
pause
