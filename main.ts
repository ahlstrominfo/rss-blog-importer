import { App, Notice, Plugin, PluginSettingTab, Setting, requestUrl, TFile, normalizePath } from 'obsidian';
import TurndownService from 'turndown';

interface RSSBlogImporterSettings {
	rssUrl: string;
	folderPath: string;
	imageFolder: string;
	lastImportedPostDate: number;
	fetchOnStartup: boolean;
	appendBacklink: string;
	enableCategoryBacklinks: boolean;
}

const DEFAULT_SETTINGS: RSSBlogImporterSettings = {
	rssUrl: '',
	folderPath: 'Blog Posts',
	imageFolder: 'Blog Images',
	lastImportedPostDate: 0,
	fetchOnStartup: true,
	appendBacklink: '',
	enableCategoryBacklinks: false
};

export default class RSSBlogImporter extends Plugin {
	settings: RSSBlogImporterSettings;
	turndownService: TurndownService;

	async onload() {
		console.log('=== RSS BLOG IMPORTER PLUGIN STARTING ===');
		console.log('[RSS Importer] Plugin loading...');
		await this.loadSettings();

		console.log('[RSS Importer] Plugin loaded with settings:', {
			rssUrl: this.settings.rssUrl,
			folderPath: this.settings.folderPath,
			imageFolder: this.settings.imageFolder,
			fetchOnStartup: this.settings.fetchOnStartup,
			lastImportedPostDate: new Date(this.settings.lastImportedPostDate).toISOString()
		});

		this.turndownService = new TurndownService({
			headingStyle: 'atx',
			hr: '---',
			bulletListMarker: '-',
			codeBlockStyle: 'fenced',
			fence: '```',
			emDelimiter: '*',
			strongDelimiter: '**',
			linkStyle: 'inlined',
			linkReferenceStyle: 'full'
		});

		this.addCommand({
			id: 'fetch-rss-posts',
			name: 'Fetch RSS Posts',
			callback: () => this.fetchRSSPosts()
		});

		this.addSettingTab(new RSSBlogImporterSettingTab(this.app, this));

		if (this.settings.fetchOnStartup && this.settings.rssUrl) {
			console.log('[RSS Importer] Fetch on startup enabled, scheduling fetch in 2 seconds...');
			setTimeout(() => {
				console.log('[RSS Importer] Executing scheduled startup fetch');
				this.fetchRSSPosts();
			}, 2000);
		} else {
			console.log('[RSS Importer] Fetch on startup disabled or no RSS URL configured');
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async fetchRSSPosts() {
		console.log('=== FETCH RSS POSTS CALLED ===');
		console.log('Current time:', new Date().toISOString());
		
		if (!this.settings.rssUrl) {
			console.log('[RSS Importer] No RSS URL configured');
			new Notice('Please configure RSS URL in settings');
			return;
		}

		try {
			console.log('[RSS Importer] Starting RSS fetch process');
			console.log('[RSS Importer] Settings:', {
				rssUrl: this.settings.rssUrl,
				folderPath: this.settings.folderPath,
				lastImportedPostDate: new Date(this.settings.lastImportedPostDate).toISOString(),
				lastImportedPostDateMs: this.settings.lastImportedPostDate
			});
			
			new Notice('Fetching RSS posts...');
			
			// Add cache busting to force fresh RSS fetch
			const cacheBustUrl = this.settings.rssUrl + (this.settings.rssUrl.includes('?') ? '&' : '?') + '_t=' + Date.now();
			console.log('[RSS Importer] Fetching URL:', cacheBustUrl);
			
			const response = await requestUrl({ 
				url: cacheBustUrl,
				headers: {
					'Cache-Control': 'no-cache',
					'Pragma': 'no-cache'
				}
			});
			
			console.log('[RSS Importer] Response status:', response.status);
			console.log('[RSS Importer] Response size:', response.text.length, 'characters');
			
			const parser = new DOMParser();
			const xmlDoc = parser.parseFromString(response.text, 'application/xml');
			
			// Check for XML parsing errors
			const parseError = xmlDoc.querySelector('parsererror');
			if (parseError) {
				console.error('[RSS Importer] XML parsing error:', parseError.textContent);
				throw new Error('Failed to parse RSS feed XML');
			}
			
			// Handle RSS 2.0 or Atom feeds
			const feedTitle = xmlDoc.querySelector('title')?.textContent || 'Unknown Feed';
			const items = Array.from(xmlDoc.querySelectorAll('item, entry'));
			
			console.log('[RSS Importer] Feed title:', feedTitle);
			console.log('[RSS Importer] Total items found:', items.length);

			let newPostsCount = 0;
			let skippedPostsCount = 0;
			let latestImportedDate = this.settings.lastImportedPostDate;
			
			for (let i = 0; i < items.length; i++) {
				const item = items[i];
				const title = item.querySelector('title')?.textContent || `Untitled ${i + 1}`;
				const pubDateText = item.querySelector('pubDate, published, updated')?.textContent;
				const pubDate = pubDateText ? new Date(pubDateText) : new Date();
				
				console.log(`[RSS Importer] Processing item ${i + 1}/${items.length}:`, {
					title: title,
					pubDateText: pubDateText,
					pubDate: pubDate.toISOString(),
					pubDateMs: pubDate.getTime(),
					lastImportedPostDateMs: this.settings.lastImportedPostDate,
					isNew: pubDate.getTime() > this.settings.lastImportedPostDate
				});
				
				if (pubDate.getTime() > this.settings.lastImportedPostDate) {
					console.log(`[RSS Importer] Creating new post: ${title}`);
					try {
						await this.createBlogPost(item, feedTitle);
						newPostsCount++;
						// Track the latest post date we successfully imported
						if (pubDate.getTime() > latestImportedDate) {
							latestImportedDate = pubDate.getTime();
						}
						console.log(`[RSS Importer] Successfully created post: ${title}`);
					} catch (error) {
						console.error(`[RSS Importer] Failed to create post "${title}":`, error);
					}
				} else {
					skippedPostsCount++;
					console.log(`[RSS Importer] Skipping older post: ${title} (${pubDate.toISOString()})`);
				}
			}

			// Update lastImportedPostDate to the newest post we actually imported
			if (latestImportedDate > this.settings.lastImportedPostDate) {
				console.log('[RSS Importer] Updating lastImportedPostDate:', {
					old: new Date(this.settings.lastImportedPostDate).toISOString(),
					new: new Date(latestImportedDate).toISOString()
				});
				this.settings.lastImportedPostDate = latestImportedDate;
				await this.saveSettings();
			} else {
				console.log('[RSS Importer] No new posts imported, keeping existing lastImportedPostDate');
			}

			console.log('[RSS Importer] Import summary:', {
				totalItems: items.length,
				newPosts: newPostsCount,
				skippedPosts: skippedPostsCount
			});

			new Notice(`Imported ${newPostsCount} new blog posts (${skippedPostsCount} skipped)`);
		} catch (error) {
			console.error('[RSS Importer] Error fetching RSS:', error);
			console.error('[RSS Importer] Error details:', {
				message: error.message,
				stack: error.stack,
				url: this.settings.rssUrl
			});
			new Notice(`Failed to fetch RSS posts: ${error.message}`);
		}
	}

	async createBlogPost(item: Element, feedTitle: string) {
		const title = this.sanitizeFileName(item.querySelector('title')?.textContent || 'Untitled');
		const pubDateText = item.querySelector('pubDate, published, updated')?.textContent;
		const pubDate = pubDateText ? new Date(pubDateText) : new Date();
		const dateStr = pubDate.toISOString().split('T')[0];
		
		const fileName = `${dateStr} - ${title}.md`;
		const filePath = normalizePath(`${this.settings.folderPath}/${fileName}`);

		console.log(`[RSS Importer] Creating blog post:`, {
			originalTitle: item.querySelector('title')?.textContent,
			sanitizedTitle: title,
			pubDateText: pubDateText,
			pubDate: pubDate.toISOString(),
			fileName: fileName,
			filePath: filePath
		});

		await this.app.vault.adapter.mkdir(this.settings.folderPath);
		await this.app.vault.adapter.mkdir(this.settings.imageFolder);

		// Try different content fields for RSS/Atom
		const contentSelectors = ['content\\:encoded', 'content', 'description', 'summary'];
		let htmlContent = '';
		let usedSelector = '';
		
		for (const selector of contentSelectors) {
			const element = item.querySelector(selector);
			if (element?.textContent) {
				htmlContent = element.textContent;
				usedSelector = selector;
				break;
			}
		}
		
		console.log(`[RSS Importer] Content extraction:`, {
			usedSelector: usedSelector,
			contentLength: htmlContent.length,
			hasContent: htmlContent.length > 0
		});
		
		const imageUrls = this.extractImageUrls(htmlContent, item);
		console.log(`[RSS Importer] Found ${imageUrls.length} images:`, imageUrls);
		
		const imageMap = new Map();

		for (let i = 0; i < imageUrls.length; i++) {
			const imageUrl = imageUrls[i];
			console.log(`[RSS Importer] Processing image ${i + 1}/${imageUrls.length}: ${imageUrl}`);
			try {
				const localImagePath = await this.downloadImage(imageUrl, title);
				if (localImagePath) {
					imageMap.set(imageUrl, localImagePath);
					console.log(`[RSS Importer] Successfully downloaded image: ${imageUrl} -> ${localImagePath}`);
				} else {
					console.log(`[RSS Importer] Failed to download image: ${imageUrl}`);
				}
			} catch (error) {
				console.error(`[RSS Importer] Error downloading image ${imageUrl}:`, error);
			}
		}

		console.log(`[RSS Importer] Image download summary: ${imageMap.size}/${imageUrls.length} successful`);

		for (const [originalUrl, localPath] of imageMap) {
			const regex = new RegExp(originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
			const matches = htmlContent.match(regex);
			if (matches) {
				console.log(`[RSS Importer] Replacing ${matches.length} occurrences of ${originalUrl} with ${localPath}`);
				htmlContent = htmlContent.replace(regex, localPath);
			}
		}

		let content = this.turndownService.turndown(htmlContent);
		console.log(`[RSS Importer] Markdown conversion: ${htmlContent.length} chars HTML -> ${content.length} chars Markdown`);
		
		const categories = this.extractCategories(item);
		console.log(`[RSS Importer] Extracted categories:`, categories);
		
		content = this.appendBacklinkToContent(content, categories);

		const sourceUrl = item.querySelector('link, guid')?.textContent || '';
		console.log(`[RSS Importer] Source URL: ${sourceUrl}`);

		const frontmatter = `---
title: "${title}"
date: ${pubDate.toISOString()}
source: ${sourceUrl}
feed: "${feedTitle || ''}"
imported: ${new Date().toISOString()}
---

`;

		const fullContent = frontmatter + content;
		console.log(`[RSS Importer] Final content length: ${fullContent.length} characters`);

		try {
			await this.app.vault.create(filePath, fullContent);
			console.log(`[RSS Importer] Successfully created file: ${filePath}`);
		} catch (error) {
			if (error.message.includes('already exists')) {
				console.log(`[RSS Importer] Post already exists: ${fileName}`);
				throw new Error(`Post already exists: ${fileName}`);
			} else {
				console.error(`[RSS Importer] Failed to create file ${filePath}:`, error);
				throw error;
			}
		}
	}

	extractImageUrls(content: string, item: Element): string[] {
		const urls = new Set<string>();
		
		const imgRegex = /<img[^>]+src="([^"]+)"/gi;
		let match;
		while ((match = imgRegex.exec(content)) !== null) {
			urls.add(match[1]);
		}

		// Check for media:content elements
		const mediaElements = item.querySelectorAll('media\\:content');
		for (let i = 0; i < mediaElements.length; i++) {
			const media = mediaElements[i];
			const url = media.getAttribute('url');
			const medium = media.getAttribute('medium');
			if (url && medium === 'image') {
				urls.add(url);
			}
		}

		return Array.from(urls);
	}

	async downloadImage(imageUrl: string, postTitle: string): Promise<string | null> {
		try {
			console.log(`[RSS Importer] Downloading image: ${imageUrl}`);
			const response = await requestUrl({ url: imageUrl });
			
			console.log(`[RSS Importer] Image response status: ${response.status}, size: ${response.arrayBuffer.byteLength} bytes`);
			
			const urlParts = imageUrl.split('/');
			const fileName = urlParts[urlParts.length - 1] || 'image';
			const extension = fileName.split('.').pop() || 'jpg';
			
			const sanitizedTitle = this.sanitizeFileName(postTitle);
			const imageName = `${sanitizedTitle}-${Date.now()}.${extension}`;
			const imagePath = normalizePath(`${this.settings.imageFolder}/${imageName}`);
			
			console.log(`[RSS Importer] Saving image as: ${imagePath}`);
			await this.app.vault.createBinary(imagePath, response.arrayBuffer);
			
			const result = `![[${imageName}]]`;
			console.log(`[RSS Importer] Image download successful: ${imageUrl} -> ${result}`);
			return result;
		} catch (error) {
			console.error(`[RSS Importer] Failed to download image ${imageUrl}:`, error);
			return null;
		}
	}

	sanitizeFileName(name: string): string {
		return name.replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, ' ').trim();
	}

	extractCategories(item: Element): string[] {
		const categories: string[] = [];
		
		// Extract categories from RSS category elements
		const categoryElements = item.querySelectorAll('category');
		for (let i = 0; i < categoryElements.length; i++) {
			const cat = categoryElements[i];
			const text = cat.textContent?.trim();
			if (text) categories.push(text);
		}

		// Clean and deduplicate categories
		return [...new Set(categories)]
			.map(cat => cat.trim())
			.filter(cat => cat.length > 0);
	}

	appendBacklinkToContent(content: string, categories: string[] = []): string {
		let result = content;

		// Add category backlinks if enabled
		if (this.settings.enableCategoryBacklinks && categories.length > 0) {
			const categoryBacklinks = categories
				.map(category => `[[${category}]]`)
				.join(' ');
			result += '\n\n' + categoryBacklinks;
		}

		// Add custom backlink if specified
		if (this.settings.appendBacklink.trim()) {
			const backlink = this.settings.appendBacklink.trim();
			const formattedBacklink = backlink.startsWith('[[') && backlink.endsWith(']]') 
				? backlink 
				: `[[${backlink}]]`;
			result += '\n\n' + formattedBacklink;
		}

		return result;
	}
}

class RSSBlogImporterSettingTab extends PluginSettingTab {
	plugin: RSSBlogImporter;

	constructor(app: App, plugin: RSSBlogImporter) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('RSS Feed URL')
			.setDesc('The URL of your blog\'s RSS feed')
			.addText(text => text
				.setPlaceholder('https://example.com/rss')
				.setValue(this.plugin.settings.rssUrl)
				.onChange(async (value) => {
					this.plugin.settings.rssUrl = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Blog Posts Folder')
			.setDesc('Folder where blog posts will be saved')
			.addText(text => text
				.setPlaceholder('Blog Posts')
				.setValue(this.plugin.settings.folderPath)
				.onChange(async (value) => {
					this.plugin.settings.folderPath = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Images Folder')
			.setDesc('Folder where downloaded images will be saved')
			.addText(text => text
				.setPlaceholder('Blog Images')
				.setValue(this.plugin.settings.imageFolder)
				.onChange(async (value) => {
					this.plugin.settings.imageFolder = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Fetch on Startup')
			.setDesc('Automatically fetch new posts when Obsidian starts')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.fetchOnStartup)
				.onChange(async (value) => {
					this.plugin.settings.fetchOnStartup = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Enable Category Backlinks')
			.setDesc('Automatically add RSS feed categories as backlinks at the end of posts')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableCategoryBacklinks)
				.onChange(async (value) => {
					this.plugin.settings.enableCategoryBacklinks = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Append Backlink')
			.setDesc('Backlink to append at the end of each imported post (e.g., "blog posts")')
			.addText(text => text
				.setPlaceholder('blog posts')
				.setValue(this.plugin.settings.appendBacklink)
				.onChange(async (value) => {
					this.plugin.settings.appendBacklink = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Manual Fetch')
			.setDesc('Manually fetch new posts from RSS feed')
			.addButton(button => button
				.setButtonText('Fetch Now')
				.setCta()
				.onClick(() => this.plugin.fetchRSSPosts()));

		new Setting(containerEl)
			.setName('Reset Import Cache')
			.setDesc('Reset the last imported post date to re-import all posts from RSS feed')
			.addButton(button => button
				.setButtonText('Reset Cache')
				.setWarning()
				.onClick(async () => {
					this.plugin.settings.lastImportedPostDate = 0;
					await this.plugin.saveSettings();
					new Notice('Import cache reset. Next fetch will import all posts.');
				}));
	}
}