# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build Commands
- `npm run dev` - Start development mode with file watching and source maps
- `npm run build` - Production build with TypeScript type checking
- `npm run version` - Bump version and update manifest/versions files

### Type Checking
Always run `tsc -noEmit -skipLibCheck` before building to ensure type safety.

## Project Architecture

This is an **Obsidian plugin** that imports blog posts from RSS feeds. The entire plugin logic is contained in a single file (`main.ts`) following Obsidian's plugin architecture patterns.

### Core Components

**Main Plugin Class (`RSSBlogImporter`)**
- Extends Obsidian's `Plugin` class
- Handles RSS parsing using `rss-parser` library
- Converts HTML to Markdown using `turndown` service
- Downloads and manages images from blog posts
- Implements settings persistence and UI

**Settings Management**
- Uses Obsidian's built-in settings system (`loadData`/`saveData`)
- Custom settings tab with UI controls for all configuration options
- Settings include RSS URL, folder paths, auto-fetch behavior, and backlink options

**Content Processing Pipeline**
1. RSS feed fetching with cache-busting
2. HTML content extraction from RSS items
3. Image URL extraction and downloading
4. HTML to Markdown conversion
5. Frontmatter generation with metadata
6. File creation with sanitized filenames

### Dependencies

**Runtime Dependencies**
- `rss-parser` - RSS feed parsing
- `turndown` - HTML to Markdown conversion

**Development Dependencies**
- Uses esbuild for bundling (configured in `esbuild.config.mjs`)
- TypeScript with ES6 target
- Obsidian API types

### File Structure

- `main.ts` - Single-file plugin implementation
- `manifest.json` - Obsidian plugin metadata
- `esbuild.config.mjs` - Build configuration with development/production modes
- `tsconfig.json` - TypeScript configuration for ES6/ESNext modules
- Output: `main.js` (bundled plugin file)

### Key Implementation Details

**Obsidian Integration**
- Uses `requestUrl` for HTTP requests (Obsidian's CORS-enabled fetch)
- File creation via `app.vault.create` and `app.vault.createBinary`
- Folder management with `app.vault.adapter.mkdir`
- Command palette integration
- Settings tab integration

**Content Processing**
- Handles various RSS content fields (`content:encoded`, `description`, etc.)
- Image downloading preserves original URLs in content replacement
- Frontmatter includes date, source URL, feed title, and import timestamp
- File naming follows `YYYY-MM-DD - Title.md` pattern
- Sanitizes filenames for filesystem compatibility

**State Management**
- Tracks last fetch time to avoid duplicate imports
- Persistent settings storage
- Import history prevents re-importing existing posts

The plugin follows Obsidian's recommended patterns for file manipulation, settings management, and user notifications.