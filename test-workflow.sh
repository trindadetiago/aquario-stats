#!/bin/bash

# Local Test Script for Aquário Stats Workflow
# This script simulates the GitHub Actions workflow locally

set -e  # Exit on any error

echo "🚀 Starting Local Test of Aquário Stats Workflow"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "scripts/fetch-contributors.js" ]; then
    print_error "Please run this script from the root directory of aquario-stats"
    exit 1
fi

print_status "✅ Found project files"

# Check Node.js installation
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18+ is required. Current version: $(node --version)"
    exit 1
fi

print_success "✅ Node.js $(node --version) is installed"

# Check Python installation
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is not installed. Please install Python 3.9+"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
print_success "✅ Python $PYTHON_VERSION is installed"

# Check if requirements.txt exists
if [ ! -f "requirements.txt" ]; then
    print_error "requirements.txt not found"
    exit 1
fi

print_status "📦 Installing Python dependencies..."
if pip3 install -r requirements.txt; then
    print_success "✅ Python dependencies installed"
else
    print_error "Failed to install Python dependencies"
    exit 1
fi

# Clean up old files (no backup needed)
print_status "🧹 Cleaning up old files..."

# Clean up old contributor data files
print_status "🧹 Cleaning up old contributor data files..."
rm -f contributors-*.json
print_success "✅ Old data files cleaned"

echo ""
echo "🔄 Step 1: Fetching Contributor Data"
echo "===================================="

print_status "Fetching data from ralfferreira/aquario..."
if node scripts/fetch-contributors.js ralfferreira aquario; then
    print_success "✅ Contributor data fetched successfully"
else
    print_error "Failed to fetch contributor data"
    exit 1
fi

# Check if data file was created
CONTRIBUTOR_FILES=$(ls contributors-*.json 2>/dev/null | wc -l)
if [ "$CONTRIBUTOR_FILES" -eq 0 ]; then
    print_error "No contributor data files were created"
    exit 1
fi

print_success "✅ Found $CONTRIBUTOR_FILES contributor data file(s)"

echo ""
echo "📊 Step 2: Generating Insights Markdown"
echo "======================================="

print_status "Generating insights markdown..."
if node scripts/generate-insights.js; then
    print_success "✅ Insights markdown generated successfully"
else
    print_error "Failed to generate insights markdown"
    exit 1
fi

# Check if markdown file was created
if [ ! -f "CONTRIBUTOR_INSIGHTS.md" ]; then
    print_error "CONTRIBUTOR_INSIGHTS.md was not created"
    exit 1
fi

print_success "✅ CONTRIBUTOR_INSIGHTS.md created ($(wc -l < CONTRIBUTOR_INSIGHTS.md) lines)"

echo ""
echo "🎨 Step 3: Generating Visualization Images"
echo "==========================================="

print_status "Generating visualization images..."
if python3 scripts/generate-images.py; then
    print_success "✅ Visualization images generated successfully"
else
    print_error "Failed to generate visualization images"
    exit 1
fi

# Check if images directory was created and has files
if [ ! -d "images" ]; then
    print_error "Images directory was not created"
    exit 1
fi

IMAGE_COUNT=$(ls images/*.png 2>/dev/null | wc -l)
if [ "$IMAGE_COUNT" -eq 0 ]; then
    print_error "No image files were created in the images directory"
    exit 1
fi

print_success "✅ Images directory created with $IMAGE_COUNT image(s)"

# List generated files
echo ""
echo "📁 Generated Files:"
echo "=================="
print_status "Markdown Report:"
ls -la CONTRIBUTOR_INSIGHTS.md

print_status "Images:"
ls -la images/

echo ""
echo "📊 Step 4: Preview of Generated Content"
echo "======================================"

print_status "First 20 lines of CONTRIBUTOR_INSIGHTS.md:"
echo "-----------------------------------------------"
head -20 CONTRIBUTOR_INSIGHTS.md

echo ""
echo "🎯 Step 5: Validation Checks"
echo "============================"

# Validate markdown content
if grep -q "Total Contributors" CONTRIBUTOR_INSIGHTS.md; then
    print_success "✅ Markdown contains contributor statistics"
else
    print_warning "⚠️  Markdown might be missing contributor statistics"
fi

if grep -q "Top Contributors" CONTRIBUTOR_INSIGHTS.md; then
    print_success "✅ Markdown contains top contributors section"
else
    print_warning "⚠️  Markdown might be missing top contributors section"
fi

# Validate images
if [ -f "images/top3-contributors.png" ]; then
    print_success "✅ Top 3 contributors chart generated"
else
    print_warning "⚠️  Top 3 contributors chart not found"
fi

if [ -f "images/complete-ranking.png" ]; then
    print_success "✅ Complete ranking chart generated"
else
    print_warning "⚠️  Complete ranking chart not found"
fi

echo ""
echo "🎉 Local Test Completed Successfully!"
echo "===================================="
print_success "All workflow steps completed without errors"
print_status "Generated files are ready for commit"

echo ""
echo "📋 Next Steps:"
echo "=============="
echo "1. Review the generated CONTRIBUTOR_INSIGHTS.md"
echo "2. Check the images in the images/ directory"
echo "3. If everything looks good, commit and push to GitHub:"
echo "   git add ."
echo "   git commit -m '📊 Update contributor insights and visualizations'"
echo "   git push"

echo ""
echo "🔍 To view the images:"
echo "====================="
echo "• macOS: open images/"
echo "• Linux: xdg-open images/"
echo "• Windows: explorer images/"

echo ""
print_success "Local test completed! 🚀"
