const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require('path');

const app = express();

const port = process.env.PORT || 3000;
const GOOGLE_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyDBuFS2iujIr-P6ALX6CJ1RFc-Zx9upw5c"; 

const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '../'))); 

const authRoutes = require('./routes/auth');
app.use('/api', authRoutes);

app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        console.log("Mensagem recebida:", message);

        const prompt = `Tu és o assistente da MultiPower. Responde de forma curta e amigável em PT.
        Utilizador: ${message}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        res.json({ reply: text });
    } catch (error) {
        console.error("Erro na IA:", error);
        res.status(500).json({ reply: "Desculpa, estou com dificuldades técnicas agora. Tenta daqui a pouco!" });
    }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor a correr na porta ${port}`);
});