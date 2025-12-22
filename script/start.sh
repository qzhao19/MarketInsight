#!/bin/bash

# start.sh
# MarketInsight application startup script
# This script handles environment validation, dependency installation, and application startup

set -e  # Exit on any error

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Functions for colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

print_success() {
    echo -e "${CYAN}[SUCCESS]${NC} $1"
}

# Print header
print_header() {
    echo ""
    echo "========================================"
    echo "  MarketInsight Application Startup"
    echo "========================================"
    echo ""
}

# Check Node.js version
check_node_version() {
    print_step "Checking Node.js version..."
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed."
        echo "  Please install Node.js v24.11.1+ from https://nodejs.org/"
        exit 1
    fi
    
    REQUIRED_VERSION="24.11.1"
    CURRENT_VERSION=$(node --version | sed 's/v//')
    
    if [ -f ".nvmrc" ] && command -v nvm &> /dev/null; then
        print_info "Using nvm to switch to required Node.js version..."
        nvm use
    fi
    
    print_info "Node.js version: $(node --version)"
    print_info "npm version: $(npm --version)"
}

# Check required services
check_services() {
    print_step "Checking required services..."
    
    # Check MySQL
    if ! pgrep mysqld &> /dev/null && ! pgrep -f "mysqld" &> /dev/null; then
        print_warning "MySQL server is not running."
        echo "  Start it with: brew services start mysql (macOS) or sudo systemctl start mysql (Linux)"
        read -p "Continue anyway? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        print_info "MySQL is running."
    fi
    
    # Check Redis
    if ! pgrep redis-server &> /dev/null; then
        print_warning "Redis server is not running."
        echo "  Start it with: brew services start redis (macOS) or sudo systemctl start redis (Linux)"
        read -p "Continue anyway? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        print_info "Redis is running."
    fi
}

# Check environment files
check_env_files() {
    print_step "Checking environment configuration..."
    
    REQUIRED_ENV_FILES=(".env.base" ".env.db" ".env.llm" ".env.secrets")
    MISSING_FILES=()
    
    for file in "${REQUIRED_ENV_FILES[@]}"; do
        if [ ! -f "$file" ]; then
            MISSING_FILES+=("$file")
        fi
    done
    
    if [ ${#MISSING_FILES[@]} -gt 0 ]; then
        print_error "Missing environment files:"
        for file in "${MISSING_FILES[@]}"; do
            echo "  - $file"
        done
        echo ""
        echo "Please copy and configure the example files:"
        echo "  cp env/.env.base.example .env.base"
        echo "  cp env/.env.db.example .env.db"
        echo "  cp env/.env.llm.example .env.llm"
        echo "  cp env/.env.secrets.example .env.secrets"
        exit 1
    fi
    
    print_info "All environment files are present."
}

# Install dependencies
install_dependencies() {
    print_step "Installing dependencies..."
    
    if [ -f "package-lock.json" ]; then
        print_info "Using npm ci for clean install..."
        npm ci
    else
        print_info "Using npm install..."
        npm install
    fi
    
    print_info "Dependencies installed successfully."
}

# Build application
build_application() {
    print_step "Building application..."
    
    if npm run build; then
        print_info "Application built successfully."
    else
        print_error "Build failed."
        exit 1
    fi
}

# Check database setup
check_database() {
    print_step "Checking database setup..."
    
    # Try to connect to database
    if npm run prisma:status &> /dev/null; then
        print_info "Database is configured and accessible."
    else
        print_warning "Database may not be initialized."
        read -p "Run database setup script? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            if [ -f "script/setup-db.sh" ]; then
                chmod +x script/setup-db.sh
                ./script/setup-db.sh
            else
                print_error "setup-db.sh not found."
                exit 1
            fi
        fi
    fi
}

# Start application
start_application() {
    print_step "Starting MarketInsight application..."
    echo ""
    
    MODE=${1:-dev}
    
    case $MODE in
        prod|production)
            print_info "Starting in PRODUCTION mode..."
            npm run start:prod
            ;;
        dev|development)
            print_info "Starting in DEVELOPMENT mode..."
            npm run start:dev
            ;;
        worker)
            print_info "Starting WORKER only..."
            npm run start:worker
            ;;
        *)
            print_error "Invalid mode: $MODE"
            echo "Usage: ./script/start.sh [dev|prod|worker]"
            exit 1
            ;;
    esac
}

# Print success message
print_final_message() {
    echo ""
    echo "========================================"
    print_success "Application Started Successfully!"
    echo "========================================"
    echo ""
    echo "Access points:"
    echo "  - API: http://localhost:3000"
    echo "  - API Docs: http://localhost:3000/api/docs"
    echo "  - Health Check: http://localhost:3000/health"
    echo ""
    echo "Useful commands:"
    echo "  - Stop: Ctrl+C"
    echo "  - View logs: npm run logs"
    echo "  - Run tests: npm run test"
    echo ""
}

# Main execution
main() {
    print_header
    
    # Parse arguments
    MODE=${1:-dev}
    SKIP_CHECKS=${2:-false}
    
    if [ "$SKIP_CHECKS" != "--skip-checks" ]; then
        check_node_version
        check_services
        check_env_files
        check_database
        install_dependencies
        
        # Only build for production mode
        if [ "$MODE" = "prod" ] || [ "$MODE" = "production" ]; then
            build_application
        fi
    fi
    
    start_application "$MODE"
    print_final_message
}

# Handle script arguments
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "MarketInsight Startup Script"
    echo ""
    echo "Usage: ./script/start.sh [MODE] [OPTIONS]"
    echo ""
    echo "Modes:"
    echo "  dev, development    Start in development mode (default)"
    echo "  prod, production    Build and start in production mode"
    echo "  worker              Start worker process only"
    echo ""
    echo "Options:"
    echo "  --skip-checks       Skip environment and service checks"
    echo "  --help, -h          Show this help message"
    echo ""
    exit 0
fi

# Run main function
main "$@"