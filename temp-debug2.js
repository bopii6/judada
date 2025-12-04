const fs=require('fs');
const pdf=require('./apps/server/node_modules/pdf-parse');
const target=process.argv[2];
const buffer=fs.readFileSync(target);
(async () => {
  await pdf(buffer, {
    pagerender: async (pageData) => {
      const textContent = await pageData.getTextContent();
      if (pageData.pageNumber === 6) {
        console.log('items for page 6');
        textContent.items.slice(-20).forEach(item => {
          console.log({ str: item.str, y: item.transform ? item.transform[5] : undefined });
        });
      }
      return '';
    }
  });
})();
