# RSS Blog Importer

An Obsidian plugin that automatically imports blog posts from RSS feeds with image downloading and backlink support.

## Features

- **Automatic RSS Import**: Fetches new blog posts from RSS feeds on startup
- **HTML to Markdown Conversion**: Converts HTML content to clean Markdown format
- **Image Downloads**: Automatically downloads and embeds images from blog posts
- **Backlink Support**: Optionally appends a backlink to each imported post
- **Duplicate Prevention**: Tracks import history to avoid duplicate posts
- **Customizable Folders**: Configure separate folders for posts and images

## Installation

1. Download the plugin files (`main.js`, `manifest.json`, `styles.css` if present)
2. Create a folder in your vault: `.obsidian/plugins/rss-blog-importer/`
3. Copy the plugin files to this folder
4. Restart Obsidian or reload plugins
5. Enable the plugin in Settings > Community plugins

## Configuration

Navigate to Settings > RSS Blog Importer to configure:

### Basic Settings
- **RSS Feed URL**: The URL of your blog's RSS feed
- **Blog Posts Folder**: Folder where imported posts will be saved (default: "Blog Posts")
- **Images Folder**: Folder where downloaded images will be saved (default: "Blog Images")

### Import Settings
- **Fetch on Startup**: Automatically fetch new posts when Obsidian starts
- **Append Backlink**: Optional backlink to add at the end of each post (e.g., "blog posts")

## Usage

### Automatic Import
If "Fetch on Startup" is enabled, the plugin will automatically check for new posts when Obsidian starts.

### Manual Import
Use the Command Palette (Ctrl/Cmd + P) and search for "Fetch RSS Posts" to manually import new posts.

### Output Format
Each imported post is saved as a Markdown file with:

```markdown
---
title: "Post Title"
date: 2024-01-01T12:00:00.000Z
source: https://example.com/post-url
feed: "Blog Name"
imported: 2024-01-01T12:00:00.000Z
---

[Post content in Markdown format]

[[blog posts]]
```

## File Naming

Posts are saved with the format: `YYYY-MM-DD - Post Title.md`

Special characters in titles are sanitized (replaced with hyphens) to ensure valid filenames.

## Image Handling

- Images referenced in posts are automatically downloaded
- Images are saved to the configured images folder
- Original image URLs are replaced with Obsidian-compatible links
- Failed image downloads are logged but don't prevent post import

## Development

### Building
```bash
npm install
npm run build
```

### Development Mode
```bash
npm run dev
```

## Dependencies

- [rss-parser](https://github.com/rbren/rss-parser) - RSS feed parsing
- [turndown](https://github.com/mixmark-io/turndown) - HTML to Markdown conversion

## License

MIT

## AI Usage
I used Claude Code to develop this plugin