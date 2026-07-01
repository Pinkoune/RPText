const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('./src');
let changedCount = 0;

files.forEach(file => {
  if (file.includes('items.ts')) return; // skip items.ts
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Replace import { ITEMS } with import { item as getItem } or similar if needed.
  // Actually, we can just replace import { ITEMS } with import { item } 
  // if not already imported.
  if (content.includes('import { ITEMS')) {
     if (content.includes('item,')) {
         content = content.replace(/ITEMS\s*,?/, '');
     } else if (content.includes('item }')) {
         content = content.replace(/ITEMS\s*,?/, '');
     } else {
         content = content.replace('ITEMS', 'item');
     }
  }

  // Replace ITEMS[foo] with item(foo)!
  // Beware of ITEMS[id]?.name -> item(id)?.name
  content = content.replace(/ITEMS\[(.*?)\]\?/g, 'item($1)?');
  content = content.replace(/ITEMS\[(.*?)\]/g, 'item($1)!');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    changedCount++;
    console.log("Updated", file);
  }
});
console.log("Files updated:", changedCount);
