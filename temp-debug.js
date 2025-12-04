const fs=require('fs');
const pdf=require('./apps/server/node_modules/pdf-parse');
const target=process.argv[2];
if(!target){
  console.error('missing file path');
  process.exit(1);
}
const buffer=fs.readFileSync(target);
(async () => {
  await pdf(buffer, {
    pagerender: async (pageData) => {
      const textContent = await pageData.getTextContent();
      const lines = [];
      let current = '';
      for (const raw of textContent.items) {
        const item = raw;
        const chunk = item.str || '';
        current += chunk;
        if (item.hasEOL) {
          if (current.trim()) lines.push(current.trim());
          current = '';
        } else {
          current += ' ';
        }
      }
      if (current.trim()) lines.push(current.trim());
      if (pageData.pageNumber <= 6) {
        console.log('--- page', pageData.pageNumber, '---');
        lines.slice(-6).forEach(l => console.log('line:', l));
      }
      return lines.join('\n') + '\n';
    }
  });
})();
