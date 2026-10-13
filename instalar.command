#!/bin/sh
# Crea la aplicación Ascenso (macOS) o su icono (Linux).
cd "$(dirname "$0")"
python3 instalar.py "$@"
