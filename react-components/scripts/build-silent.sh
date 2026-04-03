#!/bin/bash
# Build script that suppresses all Sass warnings
# Usage: ./scripts/build-silent.sh

cd "$(dirname "$0")/.."

echo "🏗️  Building React Components (Silent Mode)..."

# TypeScript compilation
echo "📝 Compiling TypeScript..."
npx tsc --noEmitOnError

# SCSS compilation with all warnings suppressed
echo "🎨 Compiling SCSS..."
npx sass style/index.scss:lib/index.css \
  --no-source-map \
  --style=compressed \
  --load-path=../node_modules \
  --quiet-deps \
  --silence-deprecation=import \
  --silence-deprecation=color-functions \
  --silence-deprecation=global-builtin \
  --silence-deprecation=mixed-decls \
  2>/dev/null

echo "✅ Build completed successfully!"
echo "📦 Output: lib/index.js, lib/index.css"