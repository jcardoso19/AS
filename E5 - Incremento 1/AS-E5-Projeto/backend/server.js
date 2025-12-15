const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const port = 3000;

// --- CONFIGURAÇÃO DA IA ---
// Confirma que a chave é do AI Studio: https://aistudio.google.com/app/apikey
const GOOGLE_API_KEY = "AIzaSyCfRU64BtPjnSh6CVDyN4jKFEBmEz5aUeQ"; 

const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

// Com a biblioteca atualizada, este modelo DEVE funcionar
const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-flash" });

app.use(cors());
app.use(express.json());

// --- ROTAS EXISTENTES ---
const authRoutes = require('./routes/auth');
app.use('/api', authRoutes);

// --- ROTA DO CHAT ---
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        console.log("Recebi mensagem:", message);

        const prompt = `Tu és o assistente da MultiPower. Responde de forma curta e amigável em PT.
        Utilizador: ${message}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        res.json({ reply: text });
    } catch (error) {
        console.error("Erro na IA:", error);
        // Envia o erro técnico para o chat para vermos se mudou
        res.status(500).json({ reply: `Erro técnico: ${error.message}` });
    }
});

app.listen(port, () => {
  console.log(`Servidor a correr na porta ${port}`);
});
