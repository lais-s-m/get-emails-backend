import puppeteer from 'puppeteer';

async function getAllEmailsFromAllTables(url) {
  const browser = await puppeteer.launch({
    headless: true,
  });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });
  const emails = new Set();
  // Regex simples para validar e-mails
  const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  // Coleta todos os e-mails da página, mesmo fora de tabelas
  const pageWideEmails = await page.$$eval('a[href^="mailto:"]', (links) =>
    links.map((a) => a.href.replace('mailto:', '').trim())
  );
  pageWideEmails
    .filter((email) => emailRegex.test(email))
    .forEach((email) => emails.add(email));
  // (2) Busca e-mails no texto da página inteira
  const allText = await page.evaluate(() => document.body.innerText);
  const textEmails = Array.from(
    allText.matchAll(/[^@\s]+@[^@\s]+\.[^@\s]+/g)
  ).map((m) => m[0]);
  textEmails.forEach((email) => emails.add(email));
  // Encontra todas as tabelas na página
  const tableSelectors = await page.$$eval('table', (tables) =>
    tables.map((table, idx) => {
      // Gera um seletor único para cada tabela
      table.setAttribute('data-table-idx', idx.toString());
      return `table[data-table-idx="${idx}"]`;
    })
  );
  for (const tableSelector of tableSelectors) {
    let hasNext = true;
    let pageNum = 1;
    while (hasNext) {
      try {
        // Espera os e-mails da tabela carregar
        await page.waitForSelector(`${tableSelector} a[href^="mailto:"]`, {
          timeout: 5000,
        });
        // Extrai e-mails da tabela atual
        const pageEmails = await page.$$eval(
          `${tableSelector} a[href^="mailto:"]`,
          (links) => links.map((a) => a.href.replace('mailto:', '').trim())
        );
        pageEmails
          .filter((email) => emailRegex.test(email))
          .forEach((email) => emails.add(email));
        // (1) Busca e-mails em texto puro nas células da tabela
        const tableTextEmails = await page.$$eval(
          `${tableSelector} td`,
          (tds) =>
            tds
              .map((td) => td.innerText.trim())
              .filter((text) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text))
        );
        tableTextEmails.forEach((email) => emails.add(email));
        console.log(
          `Tabela ${tableSelector} - Página ${pageNum}: ${
            pageEmails.length + tableTextEmails.length
          } e-mails encontrados (total até agora: ${emails.size})`
        );
      } catch (e) {
        // Se não encontrar e-mails na tabela, apenas continue
        console.error(
          `Erro ao processar tabela ${tableSelector} na página ${url}:`,
          e
        );
      }
      // Tenta clicar no botão "Próximo" relativo à tabela
      let nextButton = null;
      console.log('nextButton =>', nextButton);
      const tableId = await page.$eval(tableSelector, (table) => table.id);
      if (tableId) {
        nextButton = await page.$(
          `#${tableId}_next.paginate_button.next:not(.disabled)`
        );
      }

      if (nextButton) {
        await nextButton.click();
        await new Promise((res) => setTimeout(res, 1500)); // espera a próxima página carregar
        pageNum++;
      } else {
        hasNext = false;
      }
    }
  }
  await browser.close();
  return Array.from(emails);
}
// CLI usage: node get-emails-puppeteer.js <url>
if (
  import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url === process.argv[1]
) {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: node get-emails-puppeteer.js <url>');
    process.exit(1);
  }
  getAllEmailsFromAllTables(url).then((emails) => {
    emails.forEach((email) => console.log(email));
    console.log(`Total: ${emails.length}`);
  });
}
export default getAllEmailsFromAllTables;
