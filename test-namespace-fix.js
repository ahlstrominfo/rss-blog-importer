/**
 * Test the namespace selector fix for content:encoded elements
 */

const fs = require('fs');

// Read the test RSS feed
const rssContent = fs.readFileSync('test-rss-feed.xml', 'utf8');

// Parse XML using DOMParser (browser environment simulation)
const { DOMParser } = require('xmldom');
const parser = new DOMParser();
const doc = parser.parseFromString(rssContent, 'text/xml');

// Get first RSS item
const items = doc.getElementsByTagName('item');
const testItem = items[0];

console.log('=== NAMESPACE SELECTOR TEST ===');

if (testItem) {
    const title = testItem.getElementsByTagName('title')[0]?.textContent;
    console.log(`Testing item: ${title}`);
    console.log('');
    
    // Test different methods to find content:encoded
    console.log('Method 1 - querySelector with escaped colon:');
    const method1 = testItem.querySelector('content\\:encoded');
    console.log('  Result:', method1 ? 'FOUND' : 'NOT FOUND');
    if (method1) console.log('  Content length:', method1.textContent?.length || 0);
    
    console.log('');
    console.log('Method 2 - querySelector with attribute selector:');
    const method2 = testItem.querySelector('[*|encoded]');
    console.log('  Result:', method2 ? 'FOUND' : 'NOT FOUND');
    if (method2) console.log('  Content length:', method2.textContent?.length || 0);
    
    console.log('');
    console.log('Method 3 - getElementsByTagName with colon:');
    const method3 = testItem.getElementsByTagName('content:encoded')[0];
    console.log('  Result:', method3 ? 'FOUND' : 'NOT FOUND');
    if (method3) console.log('  Content length:', method3.textContent?.length || 0);
    
    console.log('');
    console.log('Method 4 - getElementsByTagNameNS (proper namespace):');
    const method4 = testItem.getElementsByTagNameNS('http://purl.org/rss/1.0/modules/content/', 'encoded')[0];
    console.log('  Result:', method4 ? 'FOUND' : 'NOT FOUND');
    if (method4) console.log('  Content length:', method4.textContent?.length || 0);
    
    console.log('');
    console.log('Method 5 - Manual child node search:');
    let method5 = null;
    for (let i = 0; i < testItem.childNodes.length; i++) {
        const node = testItem.childNodes[i];
        if (node.nodeName === 'content:encoded') {
            method5 = node;
            break;
        }
    }
    console.log('  Result:', method5 ? 'FOUND' : 'NOT FOUND');
    if (method5) console.log('  Content length:', method5.textContent?.length || 0);
    
    // Test our combined approach
    console.log('');
    console.log('=== COMBINED APPROACH (Plugin Logic) ===');
    const combinedResult = testItem.querySelector('content\\:encoded') || 
                          testItem.querySelector('[*|encoded]') ||
                          testItem.getElementsByTagName('content:encoded')[0] ||
                          testItem.getElementsByTagNameNS('http://purl.org/rss/1.0/modules/content/', 'encoded')[0];
    
    console.log('Combined result:', combinedResult ? 'FOUND' : 'NOT FOUND');
    
    if (combinedResult) {
        console.log('Content length:', combinedResult.textContent?.length || 0);
        console.log('Content preview:', combinedResult.textContent?.substring(0, 200) + '...');
        
        // Test against description fallback
        const description = testItem.getElementsByTagName('description')[0];
        const descLength = description?.textContent?.length || 0;
        
        console.log('');
        console.log('Comparison with description:');
        console.log(`  content:encoded: ${combinedResult.textContent?.length || 0} chars`);
        console.log(`  description: ${descLength} chars`);
        console.log(`  content:encoded is longer: ${(combinedResult.textContent?.length || 0) > descLength}`);
    }
    
} else {
    console.log('No RSS items found');
}