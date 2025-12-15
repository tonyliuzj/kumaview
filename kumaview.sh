#!/bin/bash

set -e

GIT_REPO="https://github.com/tonyliuzj/kumaview.git"
INSTALL_DIR="$HOME/kumaview"
DEFAULT_PORT=3000

show_menu() {
  echo "========== KumaView Installer =========="
  echo "1) Install"
  echo "2) Update"
  echo "3) Uninstall"
  echo "========================================"
  read -r -p "Select an option [1-3]: " CHOICE </dev/tty
  echo ""
  case $CHOICE in
    1) install_kumaview ;;
    2) update_kumaview ;;
    3) uninstall_kumaview ;;
    *) echo "Invalid choice. Exiting." ; exit 1 ;;
  esac
}

install_kumaview() {
  echo "Starting KumaView Installation..."

  echo "Installing system dependencies..."
  sudo apt update
  sudo apt install -y git curl sqlite3 build-essential python3

  echo "Checking Node.js version..."
  if command -v node >/dev/null 2>&1; then
    VERSION=$(node -v | sed 's/^v//')
    MAJOR=${VERSION%%.*}
    if [ "$MAJOR" -lt 18 ]; then
      echo "Node.js v$VERSION detected (<18)."
      read -r -p "Do you want to install Node.js 22? (y/n): " INSTALL_22 </dev/tty
      if [[ "$INSTALL_22" =~ ^[Yy]$ ]]; then
        echo "Installing Node.js 22..."
        curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
        sudo apt install -y nodejs
      else
        echo "Installation requires Node.js >=18. Exiting."
        exit 1
      fi
    else
      echo "Node.js v$VERSION detected. Skipping installation."
    fi
  else
    echo "Node.js not found. Installing Node.js 22..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt install -y nodejs
  fi

  echo "Checking for PM2..."
  if command -v pm2 >/dev/null 2>&1; then
    echo "PM2 is already installed. Skipping installation."
  else
    echo "Installing PM2..."
    npm install -g pm2
  fi

  if [ -d "$INSTALL_DIR" ]; then
    if [ -d "$INSTALL_DIR/.git" ]; then
      echo "Repository already exists. Pulling latest changes..."
      cd "$INSTALL_DIR"
      git pull
    else
      echo "Directory exists but is not a git repository. Removing and cloning fresh..."
      rm -rf "$INSTALL_DIR"
      git clone "$GIT_REPO" "$INSTALL_DIR"
      cd "$INSTALL_DIR"
    fi
  else
    git clone "$GIT_REPO" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
  fi

  echo "Installing TypeScript..."
  npm install -g typescript

  echo "Configuring environment..."
  if [ -f "$INSTALL_DIR/example.env.local" ]; then
    cp "$INSTALL_DIR/example.env.local" "$INSTALL_DIR/.env.local"
    echo ".env.local created from example.env.local"
  else
    echo "Warning: example.env.local not found. Creating basic .env.local..."
    touch "$INSTALL_DIR/.env.local"
  fi

  read -r -p "Enter port number (default: $DEFAULT_PORT): " APP_PORT </dev/tty
  APP_PORT=${APP_PORT:-$DEFAULT_PORT}

  echo "Generating JWT secret..."
  JWT_SECRET=$(openssl rand -base64 32)

  echo "Updating .env.local with configuration..."
  if grep -q "^PORT=" "$INSTALL_DIR/.env.local"; then
    sed -i "s|^PORT=.*|PORT=$APP_PORT|" "$INSTALL_DIR/.env.local"
  else
    echo "PORT=$APP_PORT" >> "$INSTALL_DIR/.env.local"
  fi

  if grep -q "^JWT_SECRET=" "$INSTALL_DIR/.env.local"; then
    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" "$INSTALL_DIR/.env.local"
  else
    echo "JWT_SECRET=$JWT_SECRET" >> "$INSTALL_DIR/.env.local"
  fi

  echo "Creating data directory for SQLite database..."
  mkdir -p "$INSTALL_DIR/data"

  echo "Installing project dependencies..."
  npm install

  echo "Building the app..."
  npm run build

  echo "Starting KumaView under PM2 on port $APP_PORT..."
  pm2 start "npm run start -- -p $APP_PORT" --name "kumaview"
  pm2 save
  pm2 startup || true

  echo ""
  echo "=========================================="
  echo "Installation complete!"
  echo "=========================================="
  echo "Visit: http://localhost:$APP_PORT"
  echo ""
  echo "Next steps:"
  echo "1. Open the dashboard in your browser"
  echo "2. Click the Settings button"
  echo "3. Add your Uptime Kuma sources"
  echo "4. Sync your monitors"
  echo ""
  echo "Useful commands:"
  echo "- View PM2 processes: pm2 list"
  echo "- See logs: pm2 logs kumaview"
  echo "- Restart: pm2 restart kumaview"
  echo "- Stop: pm2 stop kumaview"
  echo "=========================================="
  echo ""
  read -r -p "Press Enter to exit..." </dev/tty
}

update_kumaview() {
  echo "Updating KumaView..."

  if [ ! -d "$INSTALL_DIR/.git" ]; then
    echo "KumaView not installed or not a git repository in $INSTALL_DIR."
    exit 1
  fi

  cd "$INSTALL_DIR"

  echo "Backing up database..."
  if [ -f "$INSTALL_DIR/data/kumaview.db" ]; then
    cp "$INSTALL_DIR/data/kumaview.db" "$INSTALL_DIR/data/kumaview.db.backup.$(date +%Y%m%d_%H%M%S)"
    echo "Database backed up successfully."
  fi

  echo "Pulling latest changes..."
  git pull

  echo "Updating dependencies..."
  npm install

  echo "Checking JWT_SECRET configuration..."
  if [ ! -f "$INSTALL_DIR/.env.local" ]; then
    echo "Warning: .env.local not found. Creating from example..."
    if [ -f "$INSTALL_DIR/example.env.local" ]; then
      cp "$INSTALL_DIR/example.env.local" "$INSTALL_DIR/.env.local"
    else
      touch "$INSTALL_DIR/.env.local"
    fi
  fi

  # Check if JWT_SECRET is missing or empty
  if ! grep -q "^JWT_SECRET=.\\+" "$INSTALL_DIR/.env.local"; then
    echo "JWT_SECRET not found or empty. Generating new JWT secret..."
    JWT_SECRET=$(openssl rand -base64 32)
    if grep -q "^JWT_SECRET=" "$INSTALL_DIR/.env.local"; then
      sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" "$INSTALL_DIR/.env.local"
    else
      echo "JWT_SECRET=$JWT_SECRET" >> "$INSTALL_DIR/.env.local"
    fi
    echo "JWT_SECRET added to .env.local"
  else
    echo "JWT_SECRET already configured."
  fi

  echo "Rebuilding the app..."
  npm run build

  echo "Restarting KumaView with PM2..."
  pm2 restart kumaview

  echo ""
  echo "=========================================="
  echo "Update complete!"
  echo "=========================================="
  echo "Your database has been preserved."
  echo "Visit: http://localhost:$(pm2 info kumaview | grep -oP '(?<=port )\d+' || echo $DEFAULT_PORT)"
  echo "=========================================="
  echo ""
  read -r -p "Press Enter to exit..." </dev/tty
}

uninstall_kumaview() {
  echo "Uninstalling KumaView..."

  if pm2 list | grep -q kumaview; then
    echo "Stopping and removing KumaView from PM2..."
    pm2 stop kumaview
    pm2 delete kumaview
    pm2 save
  fi

  if [ -d "$INSTALL_DIR" ]; then
    read -r -p "Do you want to backup the database before uninstalling? (y/n): " BACKUP_DB </dev/tty
    if [[ "$BACKUP_DB" =~ ^[Yy]$ ]]; then
      if [ -f "$INSTALL_DIR/data/kumaview.db" ]; then
        BACKUP_PATH="$HOME/kumaview_backup_$(date +%Y%m%d_%H%M%S).db"
        cp "$INSTALL_DIR/data/kumaview.db" "$BACKUP_PATH"
        echo "Database backed up to: $BACKUP_PATH"
      else
        echo "No database found to backup."
      fi
    fi

    echo "Removing $INSTALL_DIR..."
    rm -rf "$INSTALL_DIR"
    echo "Removed $INSTALL_DIR"
  else
    echo "KumaView directory not found."
  fi

  echo ""
  echo "=========================================="
  echo "Uninstall complete!"
  echo "=========================================="
  echo "Note: Node.js, PM2, and other system dependencies are NOT removed."
  echo "Remove them manually if desired:"
  echo "  sudo apt remove nodejs"
  echo "  npm uninstall -g pm2"
  echo "=========================================="
  echo ""
  read -r -p "Press Enter to exit..." </dev/tty
}

show_menu
