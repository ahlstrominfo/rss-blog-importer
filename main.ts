import { App, Notice, Plugin, PluginSettingTab, Setting, requestUrl, TFile, normalizePath } from 'obsidian';
import Parser from 'rss-parser';
import TurndownService from 'turndown';

interface RSSBlogImporterSettings {
	rssUrl: string;
	folderPath: string;
	imageFolder: string;
	lastFetchTime: number;
	fetchOnStartup: boolean;
	appendBacklink: string;
	enableCategoryBacklinks: boolean;
}

const DEFAULT_SETTINGS: RSSBlogImporterSettings = {
	rssUrl: '',
	folderPath: 'Blog Posts',
	imageFolder: 'Blog Images',
	lastFetchTime: 0,
	fetchOnStartup: true,
	appendBacklink: '',
	enableCategoryBacklinks: false
};

export default class RSSBlogImporter extends Plugin {
	settings: RSSBlogImporterSettings;
	parser: Parser;
	turndownService: TurndownService;

	async onload() {
		await this.loadSettings();
		
		this.parser = new Parser({
			customFields: {
				item: [
					['media:content', 'mediaContent'],
					['content:encoded', 'contentEncoded'],
					['description', 'description']
				]
			}
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
			setTimeout(() => this.fetchRSSPosts(), 2000);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async fetchRSSPosts() {
		if (!this.settings.rssUrl) {
			new Notice('Please configure RSS URL in settings');
			return;
		}

		try {
			new Notice('Fetching RSS posts...');
			
			// Add cache busting to force fresh RSS fetch
			const cacheBustUrl = this.settings.rssUrl + (this.settings.rssUrl.includes('?') ? '&' : '?') + '_t=' + Date.now();
			
			const response = await requestUrl({ 
				url: cacheBustUrl,
				headers: {
					'Cache-Control': 'no-cache',
					'Pragma': 'no-cache'
				}
			});
			const feed = await this.parser.parseString(response.text);

			let newPostsCount = 0;
			
			for (const item of feed.items) {
				const pubDate = new Date(item.pubDate || item.isoDate || '');
				
				if (pubDate.getTime() > this.settings.lastFetchTime) {
					await this.createBlogPost(item, feed.title);
					newPostsCount++;
				}
			}

			this.settings.lastFetchTime = Date.now();
			await this.saveSettings();

			new Notice(`Imported ${newPostsCount} new blog posts`);
		} catch (error) {
			console.error('Error fetching RSS:', error);
			new Notice('Failed to fetch RSS posts');
		}
	}

	async createBlogPost(item: any, feedTitle: string) {
		const title = this.sanitizeFileName(item.title || 'Untitled');
		const pubDate = new Date(item.pubDate || item.isoDate || '');
		const dateStr = pubDate.toISOString().split('T')[0];
		
		const fileName = `${dateStr} - ${title}.md`;
		const filePath = normalizePath(`${this.settings.folderPath}/${fileName}`);

		await this.app.vault.adapter.mkdir(this.settings.folderPath);
		await this.app.vault.adapter.mkdir(this.settings.imageFolder);

		let htmlContent = item.contentEncoded || item.content || item.description || '';
		
		const imageUrls = this.extractImageUrls(htmlContent, item);
		const imageMap = new Map();

		for (const imageUrl of imageUrls) {
			try {
				const localImagePath = await this.downloadImage(imageUrl, title);
				if (localImagePath) {
					imageMap.set(imageUrl, localImagePath);
				}
			} catch (error) {
				console.error('Error downloading image:', error);
			}
		}

		for (const [originalUrl, localPath] of imageMap) {
			htmlContent = htmlContent.replace(new RegExp(originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), localPath);
		}

		let content = this.turndownService.turndown(htmlContent);
		
		const categories = this.extractCategories(item);
		content = this.appendBacklinkToContent(content, categories);

		const frontmatter = `---
title: "${title}"
date: ${pubDate.toISOString()}
source: ${item.link || ''}
feed: "${feedTitle || ''}"
imported: ${new Date().toISOString()}
---

`;

		const fullContent = frontmatter + content;

		try {
			await this.app.vault.create(filePath, fullContent);
		} catch (error) {
			if (error.message.includes('already exists')) {
				console.log(`Post already exists: ${fileName}`);
			} else {
				throw error;
			}
		}
	}

	extractImageUrls(content: string, item: any): string[] {
		const urls = new Set<string>();
		
		const imgRegex = /<img[^>]+src="([^"]+)"/gi;
		let match;
		while ((match = imgRegex.exec(content)) !== null) {
			urls.add(match[1]);
		}

		if (item.mediaContent && Array.isArray(item.mediaContent)) {
			for (const media of item.mediaContent) {
				if (media.$ && media.$.url && media.$.medium === 'image') {
					urls.add(media.$.url);
				}
			}
		}

		return Array.from(urls);
	}

	async downloadImage(imageUrl: string, postTitle: string): Promise<string | null> {
		try {
			const response = await requestUrl({ url: imageUrl });
			
			const urlParts = imageUrl.split('/');
			const fileName = urlParts[urlParts.length - 1] || 'image';
			const extension = fileName.split('.').pop() || 'jpg';
			
			const sanitizedTitle = this.sanitizeFileName(postTitle);
			const imageName = `${sanitizedTitle}-${Date.now()}.${extension}`;
			const imagePath = normalizePath(`${this.settings.imageFolder}/${imageName}`);
			
			await this.app.vault.createBinary(imagePath, response.arrayBuffer);
			
			return `![[${imageName}]]`;
		} catch (error) {
			console.error('Failed to download image:', imageUrl, error);
			return null;
		}
	}

	sanitizeFileName(name: string): string {
		return name.replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, ' ').trim();
	}

	extractCategories(item: any): string[] {
		const categories: string[] = [];
		
		// RSS parser automatically puts categories in the categories array
		if (item.categories && Array.isArray(item.categories)) {
			categories.push(...item.categories);
		}

		// Clean and deduplicate categories
		return [...new Set(categories)]
			.map(cat => typeof cat === 'string' ? cat.trim() : String(cat).trim())
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
			.setDesc('Reset the import timestamp to re-import all posts from RSS feed')
			.addButton(button => button
				.setButtonText('Reset Cache')
				.setWarning()
				.onClick(async () => {
					this.plugin.settings.lastFetchTime = 0;
					await this.plugin.saveSettings();
					new Notice('Import cache reset. Next fetch will import all posts.');
				}));
	}
}