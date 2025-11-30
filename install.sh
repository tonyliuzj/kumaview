#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔═══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                       ║${NC}"
echo -e "${GREEN}║         KumaView Installer            ║${NC}"
echo -e "${GREEN}║                                       ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════╝${NC}"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed.${NC}"
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}Error: Node.js version 18 or higher is required.${NC}"
    echo "Current version: $(node -v)"
    echo "Please upgrade Node.js from https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}✓${NC} Node.js $(node -v) detected"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed.${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} npm $(npm -v) detected"
echo ""

# Determine installation directory
INSTALL_DIR="${1:-kumaview}"

# Check if directory already exists
if [ -d "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}Warning: Directory '$INSTALL_DIR' already exists.${NC}"
    read -p "Do you want to continue and overwrite? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Installation cancelled."
        exit 1
    fi
    rm -rf "$INSTALL_DIR"
fi

# Clone the repository
echo -e "${YELLOW}Cloning KumaView repository...${NC}"
if ! git clone https://github.com/yourusername/kumaview.git "$INSTALL_DIR"; then
    echo -e "${RED}Error: Failed to clone repository.${NC}"
    exit 1
fi

cd "$INSTALL_DIR"

echo -e "${GREEN}✓${NC} Repository cloned successfully"
echo ""

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
if ! npm install; then
    echo -e "${RED}Error: Failed to install dependencies.${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Dependencies installed successfully"
echo ""

# Build the application
echo -e "${YELLOW}Building application...${NC}"
if ! npm run build; then
    echo -e "${RED}Error: Failed to build application.${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Application built successfully"
echo ""

# Create data directory
mkdir -p data

echo -e "${GREEN}╔═══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                       ║${NC}"
echo -e "${GREEN}║   Installation Complete! 🎉           ║${NC}"
echo -e "${GREEN}║                                       ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo ""
echo "1. Start the application:"
echo -e "   ${GREEN}cd $INSTALL_DIR && npm start${NC}"
echo ""
echo "2. Open your browser and navigate to:"
echo -e "   ${GREEN}http://localhost:3000${NC}"
echo ""
echo "3. Configure your first Uptime Kuma source:"
echo "   - Click the 'Settings' button"
echo "   - Add your Uptime Kuma instance URL and slug"
echo "   - Click 'Sync All' to fetch your monitors"
echo ""
echo -e "${YELLOW}Optional: Run in development mode${NC}"
echo -e "   ${GREEN}cd $INSTALL_DIR && npm run dev${NC}"
echo ""
echo "For more information, visit: https://github.com/yourusername/kumaview"
echo ""
