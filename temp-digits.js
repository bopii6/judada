const fs=require('fs');
const pdf=require('./apps/server/node_modules/pdf-parse');
const target=process.argv[2];
const buffer=fs.readFileSync(target);
(async () => {
  await pdf(buffer, {
    pagerender: async (pageData) => {
      const textContent = await pageData.getTextContent();
      const digits = textContent.items.filter(item => /^\d+$/.test(item.str || ''));
      if (pageData.pageNumber <= 8) {
        console.log('page', pageData.pageNumber, 'digits', digits.map(d => ({ str: d.str, y: d.transform ? d.transform[5] : undefined })));
      }
      return '';
    }
  });
})();
