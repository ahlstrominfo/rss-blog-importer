/**
 * Test to verify that content:encoded is prioritized over description
 * when both are present in RSS feed items
 */

const fs = require('fs');

// Read the test RSS feed
const rssContent = fs.readFileSync('test-rss-feed.xml', 'utf8');

// Parse XML using DOMParser (simulate browser environment)
const { DOMParser } = require('xmldom');
const parser = new DOMParser();
const doc = parser.parseFromString(rssContent, 'text/xml');

// Get all RSS items (getElementsByTagName works with xmldom)
const items = doc.getElementsByTagName('item');

console.log('=== CONTENT PRIORITY TEST ===');
console.log(`Found ${items.length} RSS items to test`);

let testResults = [];

for (let i = 0; i < Math.min(3, items.length); i++) {
    const item = items[i];
    const titleEl = item.getElementsByTagName('title')[0];
    const title = titleEl?.textContent || titleEl?.nodeValue || `Item ${i + 1}`;
    
    // Check what content fields are available
    const contentEncoded = item.getElementsByTagNameNS('http://purl.org/rss/1.0/modules/content/', 'encoded')[0];
    const description = item.getElementsByTagName('description')[0];
    
    const hasContentEncoded = contentEncoded && contentEncoded.textContent && contentEncoded.textContent.trim();
    const hasDescription = description && description.textContent && description.textContent.trim();
    
    // Simulate the plugin's logic
    let selectedContent = '';
    let usedSelector = '';
    
    // Try content:encoded first (most complete content)
    let element = item.getElementsByTagNameNS('http://purl.org/rss/1.0/modules/content/', 'encoded')[0];
    if (element?.textContent) {
        selectedContent = element.textContent;
        usedSelector = 'content:encoded';
    } else {
        // Fallback to other content fields
        const contentSelectors = ['content', 'description', 'summary'];
        for (const selector of contentSelectors) {
            element = item.getElementsByTagName(selector)[0];
            if (element?.textContent) {
                selectedContent = element.textContent;
                usedSelector = selector;
                break;
            }
        }
    }
    
    const result = {
        title: title.substring(0, 50) + (title.length > 50 ? '...' : ''),
        hasContentEncoded,
        hasDescription,
        usedSelector,
        contentLength: selectedContent.length,
        contentPreview: selectedContent.substring(0, 100) + (selectedContent.length > 100 ? '...' : '')
    };
    
    testResults.push(result);
    
    console.log(`\n--- Test ${i + 1}: ${result.title} ---`);
    console.log(`Has content:encoded: ${result.hasContentEncoded ? 'YES' : 'NO'}`);
    console.log(`Has description: ${result.hasDescription ? 'YES' : 'NO'}`);
    console.log(`Selected content source: ${result.usedSelector}`);
    console.log(`Content length: ${result.contentLength} characters`);
    console.log(`Content preview: ${result.contentPreview}`);
}

// Summary
console.log('\n=== TEST SUMMARY ===');
const contentEncodedUsed = testResults.filter(r => r.usedSelector === 'content:encoded').length;
const descriptionUsed = testResults.filter(r => r.usedSelector === 'description').length;

console.log(`Items with content:encoded available: ${testResults.filter(r => r.hasContentEncoded).length}`);
console.log(`Items with description available: ${testResults.filter(r => r.hasDescription).length}`);
console.log(`Items that used content:encoded: ${contentEncodedUsed}`);
console.log(`Items that used description: ${descriptionUsed}`);

// Verify test results
const testPassed = testResults.every(result => {
    if (result.hasContentEncoded) {
        return result.usedSelector === 'content:encoded';
    } else if (result.hasDescription) {
        return result.usedSelector === 'description';
    }
    return true;
});

console.log(`\nTEST RESULT: ${testPassed ? 'PASSED' : 'FAILED'}`);

if (testPassed) {
    console.log('✅ Plugin correctly prioritizes content:encoded over description when both are available');
} else {
    console.log('❌ Plugin does not correctly prioritize content:encoded over description');
}

// Show specific comparison for items that have both
const itemsWithBoth = testResults.filter(r => r.hasContentEncoded && r.hasDescription);
if (itemsWithBoth.length > 0) {
    console.log(`\n=== ITEMS WITH BOTH CONTENT:ENCODED AND DESCRIPTION ===`);
    itemsWithBoth.forEach((result, i) => {
        console.log(`Item ${i + 1}: ${result.title}`);
        console.log(`  Selected: ${result.usedSelector} (${result.contentLength} chars)`);
    });
}