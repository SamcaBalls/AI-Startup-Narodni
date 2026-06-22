@echo off
cd /d "%~dp0"
node server.mjs > server.out.log 2> server.err.log
