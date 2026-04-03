# CONTEXT.md

## Project: react-components

This project is a modular React component library, organized for development, demonstration, and styling. Below is an overview of the folder and file structure:

### Root Files

- `package.json`: Project dependencies and scripts.
- `tsconfig.json`: TypeScript configuration for the project.

### Folders

#### build/

- Contains production build artifacts (JS, CSS, source maps, and an `index.html` for previewing the build).

#### demo/

- Contains a demo application to showcase components.
- `index.html`: Entry point for the demo app.
- `main.tsx`: Main React entry file for the demo.
- `style.css`: Demo-specific styles.
- `examples/`: Example usages of components (e.g., `Basic.tsx`, `index.tsx`).

#### src/

- Source code for reusable React components.
- `Button.tsx`: Button component implementation.
- `DashboardLayout.tsx`: Dashboard layout component.
- `index.ts`: Barrel file for exporting components.

#### style/

- SCSS styles for the component library.
- `_bootstrap.scss`: Bootstrap-related styles.
- `_dashboard-layout.scss`: Dashboard layout styles.
- `index.scss`: Main entry point for styles.

## Usage

- Develop components in `src/`.
- Use `demo/` to preview and test components interactively.
- Build outputs are generated in `build/`.
- Styles are managed in `style/` and imported as needed.
