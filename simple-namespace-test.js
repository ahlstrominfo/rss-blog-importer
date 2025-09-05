/**
 * Simple test for namespace handling with Node.js xmldom
 */

const fs = require('fs');
const { DOMParser } = require('xmldom');

// Read the test RSS feed
const rssContent = fs.readFileSync('test-rss-feed.xml', 'utf8');
const parser = new DOMParser();
const doc = parser.parseFromString(rssContent, 'text/xml');

// Get first RSS item
const items = doc.getElementsByTagName('item');
const testItem = items[0];

console.log('=== SIMPLE NAMESPACE TEST ===');

if (testItem) {
    const title = testItem.getElementsByTagName('title')[0]?.textContent;
    console.log(`Testing item: ${title}`);
    console.log('');
    
    // Test manual node search (what our plugin will do)
    let contentEncoded = null;
    for (let i = 0; i < testItem.childNodes.length; i++) {
        const node = testItem.childNodes[i];
        if (node.nodeName === 'content:encoded') {
            contentEncoded = node;
            break;
        }
    }
    
    console.log('Manual search result:', contentEncoded ? 'FOUND' : 'NOT FOUND');
    
    if (contentEncoded) {
        const contentLength = contentEncoded.textContent?.length || 0;
        console.log('Content length:', contentLength);
        
        // Compare with description
        const description = testItem.getElementsByTagName('description')[0];
        const descLength = description?.textContent?.length || 0;
        
        console.log('Description length:', descLength);
        console.log('content:encoded is longer:', contentLength > descLength);
        
        console.log('');
        console.log('content:encoded preview:');
        console.log(contentEncoded.textContent?.substring(0, 300) + '...');
        
        console.log('');
        console.log('description preview:');
        console.log(description?.textContent?.substring(0, 300) + '...');
        
        console.log('');
        console.log('SUCCESS: Plugin will now use content:encoded instead of description!');
    } else {
        console.log('FAILED: Could not find content:encoded element');
    }
} else {
    console.log('No RSS items found');
}