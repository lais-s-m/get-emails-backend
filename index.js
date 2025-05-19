import express from 'express';
import getAllEmailsFromAllTables from './get-emails-puppeteer.js';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.post('/get-emails', async (req, res) => {
  const { urls } = req.body;
  if (!urls || !Array.isArray(urls)) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  const allEmails = new Set();
  for (const url of urls) {
    try {
      const emails = await getAllEmailsFromAllTables(url);
      emails.forEach((email) => allEmails.add(email));
    } catch (e) {
      console.error(`Erro ao processar ${url}:`, e);
    }
  }
  res.json({ emails: Array.from(allEmails) });
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
