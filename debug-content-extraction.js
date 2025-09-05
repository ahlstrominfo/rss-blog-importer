/**
 * Debug script to test actual content extraction from RSS feed
 * This simulates the plugin's content extraction logic
 */

const fs = require('fs');
const TurndownService = require('turndown');

// Initialize turndown service with same settings as plugin
const turndownService = new TurndownService({
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

// Parse XML using xmldom
const { DOMParser } = require('xmldom');
const parser = new DOMParser();

// Read the test RSS feed
const rssContent = fs.readFileSync('test-rss-feed.xml', 'utf8');
const doc = parser.parseFromString(rssContent, 'text/xml');

// Get the first RSS item for detailed testing
const items = doc.getElementsByTagName('item');
const firstItem = items[0];

console.log('=== DETAILED CONTENT EXTRACTION TEST ===');

if (firstItem) {
    const titleEl = firstItem.getElementsByTagName('title')[0];
    const title = titleEl?.textContent || titleEl?.nodeValue || 'Untitled';
    
    console.log(`Testing item: ${title}`);
    console.log('');
    
    // Extract content using plugin's logic
    let htmlContent = '';
    let usedSelector = '';
    
    // Try content:encoded first (most complete content) 
    let element = firstItem.getElementsByTagNameNS('http://purl.org/rss/1.0/modules/content/', 'encoded')[0];
    if (element?.textContent) {
        htmlContent = element.textContent;
        usedSelector = 'content:encoded';
    } else {
        // Fallback to other content fields
        const contentSelectors = ['content', 'description', 'summary'];
        for (const selector of contentSelectors) {
            element = firstItem.getElementsByTagName(selector)[0];
            if (element?.textContent) {
                htmlContent = element.textContent;
                usedSelector = selector;
                break;
            }
        }
    }
    
    console.log(`Content source: ${usedSelector}`);
    console.log(`HTML content length: ${htmlContent.length} characters`);
    console.log('');
    console.log('Raw HTML content:');
    console.log('================');
    console.log(htmlContent);
    console.log('');
    
    // Convert to markdown using turndown
    const markdownContent = turndownService.turndown(htmlContent);
    
    console.log('Converted markdown:');
    console.log('==================');
    console.log(markdownContent);
    console.log('');
    console.log(`Markdown content length: ${markdownContent.length} characters`);
    
    // Check if content ends with ellipsis or gets truncated
    const endsWithEllipsis = markdownContent.endsWith('...');
    const endsWithThreeDots = markdownContent.endsWith('…');
    
    console.log('');
    console.log('=== TRUNCATION ANALYSIS ===');
    console.log(`Content ends with "...": ${endsWithEllipsis}`);
    console.log(`Content ends with "…": ${endsWithThreeDots}`);
    console.log(`Last 100 characters: "${markdownContent.slice(-100)}"`);
    
    // Save the full converted content to file for inspection
    const fullContent = `---
title: "${title}"
date: ${new Date().toISOString()}
source: test
feed: "Debug Test"
imported: ${new Date().toISOString()}
---

${markdownContent}`;
    
    fs.writeFileSync('debug-extracted-content.md', fullContent);
    console.log('');
    console.log('Full content saved to: debug-extracted-content.md');
    
} else {
    console.log('No RSS items found in feed');
}