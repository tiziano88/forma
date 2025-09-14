# Justfile for lintx project

# Generate protobuf files from forma.proto and descriptor.proto using protoc
generate-proto:
    #!/usr/bin/env bash
    echo "Generating protobuf files..."
    
    # Create output directory
    mkdir -p core/src/generated
    
    # Generate JavaScript files using protoc with google-protobuf
    protoc \
        --js_out=import_style=commonjs,binary:core/src/generated \
        config/forma.proto config/descriptor.proto
    
    # Generate TypeScript declaration files using ts-protoc-gen
    protoc \
        --plugin=protoc-gen-ts=./node_modules/ts-protoc-gen/bin/protoc-gen-ts \
        --ts_out=core/src/generated \
        config/forma.proto config/descriptor.proto
    
    echo "Generated files:"
    find core/src/generated -name "*.js" -o -name "*.d.ts" -type f

# Clean generated files
clean-proto:
    rm -rf core/src/generated

# Full clean and regenerate
regen-proto: clean-proto generate-proto

# Install protoc plugin if not present
install-proto-deps:
    npm install --save-dev ts-proto

# Generate sample descriptor for web-app testing
generate-sample-desc:
    #!/usr/bin/env bash
    echo "Generating sample.proto descriptor..."

    # Generate descriptor set for sample.proto
    protoc \
        --descriptor_set_out=web-app/public/sample.desc \
        --include_imports \
        web-app/public/sample.proto

    echo "Generated sample descriptor at web-app/public/sample.desc"
    ls -la web-app/public/sample.desc

# Generate TypeScript bindings from sample.proto for testing
generate-test-proto:
    #!/usr/bin/env bash
    echo "Generating TypeScript bindings for sample.proto..."

    # Create test output directory
    mkdir -p core/src/generated/test

    # Generate JavaScript files using protoc with google-protobuf
    protoc \
        --js_out=import_style=commonjs,binary:core/src/generated/test \
        web-app/public/sample.proto

    # Generate TypeScript declaration files using ts-protoc-gen
    protoc \
        --plugin=protoc-gen-ts=./node_modules/ts-protoc-gen/bin/protoc-gen-ts \
        --ts_out=core/src/generated/test \
        web-app/public/sample.proto

    echo "Generated test TypeScript bindings:"
    find core/src/generated/test -name "*.js" -o -name "*.d.ts" -type f

# Run core package tests
test:
    cd core && pnpm test

# Run tests in watch mode
test-watch:
    cd core && pnpm test:watch

# Full test setup: generate bindings and run tests
test-all: generate-test-proto test
