#!/bin/bash
set -e

# SynAI Installation Script
# https://github.com/realutj/synai

REPO="realutj/synai"
INSTALL_DIR="$HOME/.synai"
BIN_DIR="$HOME/.local/bin"

echo "[>] Installing SynAI..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "[X] Node.js is not installed."
    echo "Please install Node.js (v18 or higher) from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "[X] Node.js version $NODE_VERSION is too old."
    echo "Please upgrade to Node.js v18 or higher."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "[X] npm is not installed."
    echo "Please install npm."
    exit 1
fi

echo "[OK] Node.js $(node -v) detected"
echo "[OK] npm $(npm -v) detected"
echo ""

# Install via npm
echo "[*] Installing synai from npm..."
if npm install -g synai 2>/dev/null; then
    echo ""
    echo "[OK] SynAI installed successfully!"
    echo ""
    echo "[+] You can now run: synai"
    echo ""
    echo "[Docs] Documentation: https://github.com/$REPO"
    echo "[Help] Issues: https://github.com/$REPO/issues"
else
    echo "[!] Global install failed. Trying local install..."
    
    # Create local bin directory if it doesn't exist
    mkdir -p "$BIN_DIR"
    
    # Add to PATH if not already there
    if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
        echo ""
        echo "[*] Adding $BIN_DIR to PATH..."
        
        if [ -f "$HOME/.bashrc" ]; then
            echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
            echo "[OK] Added to ~/.bashrc"
        fi
        
        if [ -f "$HOME/.zshrc" ]; then
            echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.zshrc"
            echo "[OK] Added to ~/.zshrc"
        fi
        
        echo ""
        echo "[!] Please restart your terminal or run:"
        echo "    source ~/.bashrc  # or ~/.zshrc"
    fi
    
    # Install locally
    npm install -g synai --prefix "$HOME/.local"
    
    echo ""
    echo "[OK] SynAI installed successfully!"
    echo ""
    echo "[+] You can now run: synai"
    echo ""
    echo "[Docs] Documentation: https://github.com/$REPO"
    echo "[Help] Issues: https://github.com/$REPO/issues"
fi
