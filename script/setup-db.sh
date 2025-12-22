#!/bin/bash
# filepath: /Users/qzhao19/Github/MarketInsight/script/setup-db.sh

# setup-db.sh
# Database initialization script for MarketInsight
# This script sets up the MySQL database, creates necessary users, and runs Prisma migrations.

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Print header
print_header() {
    echo "========================================"
    echo "  MarketInsight Database Setup"
    echo "========================================"
    echo ""
}

# Check if MySQL is installed and running
check_mysql() {
    print_step "Checking MySQL installation..."
    
    if ! command -v mysql &> /dev/null; then
        print_error "MySQL client is not installed. Please install MySQL first."
        echo "  macOS: brew install mysql"
        echo "  Ubuntu/Debian: sudo apt-get install mysql-client"
        echo "  CentOS/RHEL: sudo yum install mysql"
        exit 1
    fi

    if ! pgrep mysqld &> /dev/null && ! pgrep -f "mysqld" &> /dev/null; then
        print_warning "MySQL server is not running. Please start MySQL service."
        echo "  macOS: brew services start mysql"
        echo "  Linux: sudo systemctl start mysql"
        exit 1
    fi

    print_info "MySQL is installed and running."
}

# Check if setup-db.sql exists
check_sql_file() {
    print_step "Checking for setup-db.sql..."
    
    if [ ! -f "script/setup-db.sql" ]; then
        print_error "setup-db.sql not found in script/ directory."
        print_info "Please ensure the SQL file exists before running this script."
        exit 1
    fi
    
    print_info "Found script/setup-db.sql"
}

# Check if Node.js and npm are installed
check_node() {
    print_step "Checking Node.js installation..."
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js first."
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm first."
        exit 1
    fi
    
    print_info "Node.js $(node --version) and npm $(npm --version) are installed."
}

# Run the SQL setup script
run_sql_setup() {
    print_step "Running database setup script..."
    
    # Prompt for MySQL root password
    echo ""
    read -s -p "Enter MySQL root password: " MYSQL_ROOT_PASSWORD
    echo ""
    echo ""
    
    # Execute the SQL file
    if mysql -u root -p"$MYSQL_ROOT_PASSWORD" < script/setup-db.sql 2>/dev/null; then
        print_info "Database and user created successfully."
    else
        print_error "Failed to execute setup-db.sql."
        print_info "Please check your MySQL credentials and SQL file."
        exit 1
    fi
}

# Run Prisma commands
run_prisma_setup() {
    print_step "Running Prisma setup..."
    
    # Push Prisma schema to database
    echo ""
    print_info "Pushing Prisma schema to database..."
    if npm run prisma:push; then
        print_info "Prisma schema pushed successfully."
    else
        print_error "Failed to push Prisma schema."
        exit 1
    fi
    
    # Generate Prisma client
    echo ""
    print_info "Generating Prisma client..."
    if npm run prisma:generate; then
        print_info "Prisma client generated successfully."
    else
        print_error "Failed to generate Prisma client."
        exit 1
    fi
}

# Print success message
print_success() {
    echo ""
    echo "========================================"
    echo -e "${GREEN}✓ Database Setup Complete!${NC}"
    echo "========================================"
    echo ""
    echo "Next steps:"
    echo "  1. Start the application: npm run start:dev"
    echo "  2. Access API docs: http://localhost:3000/api/docs"
    echo "  3. Run tests: npm run test"
    echo ""
}

# Main execution
main() {
    print_header
    
    check_mysql
    check_node
    check_sql_file
    run_sql_setup
    run_prisma_setup
    print_success
}

# Run main function
main "$@"