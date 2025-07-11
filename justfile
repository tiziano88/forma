set working-directory := "structural-editor"

# Default recipe
default: build

# Install dependencies
install:
    npm install

# Run development server
dev:
    npm run dev

# Build for production
build:
    npm run build

# Preview production build
preview:
    npm run preview

# Run checks
check:
    npm run check