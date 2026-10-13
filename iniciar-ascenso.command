#!/bin/sh
# Arranca Ascenso con su base de datos (macOS y Linux). Deja esta ventana abierta mientras lo usas.
cd "$(dirname "$0")"
exec python3 servidor.py "$@"
