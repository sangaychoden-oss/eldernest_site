@echo off
cd /d "%~dp0"
if not exist node_modules (
  npm.cmd install
)
node server.js
