import express, { Request, Response } from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'Beyblade Stats API is online and ready for battle!' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});