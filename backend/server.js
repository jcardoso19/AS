const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require('path');
const { exec } = require('child_process');

const app = express();
const port = process.env.PORT || 3000;

// --- AUTO-INICIALIZAÇÃO DA BASE DE DADOS ---
// Isto substitui a necessidade de usar a Shell do Render
exec('node backend/init_db.js', (error, stdout, stderr) => {
    if (error) {
        console.error(`Erro ao iniciar DB: ${error.message}`);
        return;
    }
    console.log(`Mensagem do Sistema: ${stdout}`);
});

// Configuração Gemini
const GOOGLE_API_KEY = process.env.GEMINI_API_KEY || "A TUA CHAVE AQUI"; 
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.use(cors());
app.use(express.json());

// Servir ficheiros estáticos (HTML, CSS, JS) da raiz
app.use(express.static(path.join(__dirname, '../')));

// Rotas
const authRoutes = require('./routes/auth');
app.use('/api', authRoutes);

// Rota Chat
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        const prompt = `Tu és o assistente da MultiPower. Responde de forma curta em PT. Utilizador: ${message}`;
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        res.json({ reply: text });
    } catch (error) {
        res.status(500).json({ reply: "Erro na IA." });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor ativo na porta ${port}`);
});