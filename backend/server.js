const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();
const port = process.env.PORT || 3000;

// --- 1. CRIAÇÃO SÍNCRONA DA PASTA (CRÍTICO) ---
// Isto garante que a pasta existe ANTES de as rotas tentarem abrir a BD
const dbFolder = path.join(__dirname, 'db');
if (!fs.existsSync(dbFolder)) {
    fs.mkdirSync(dbFolder, { recursive: true });
    console.log("✅ Pasta 'db' criada com sucesso.");
}

// --- 2. INICIALIZAÇÃO DA BD ---
exec('node backend/init_db.js', (error, stdout) => {
    if (error) console.error(`Erro init_db: ${error.message}`);
    else console.log(`BD: ${stdout.trim()}`);
});

// Configuração Gemini
const GOOGLE_API_KEY = process.env.GEMINI_API_KEY || "A_TUA_CHAVE_AQUI"; 
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.use(cors());
app.use(express.json());

// Servir ficheiros da raiz
app.use(express.static(path.join(__dirname, '../')));

// Rotas - Carregadas APÓS a garantia da pasta
const authRoutes = require('./routes/auth');
app.use('/api', authRoutes);

app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        const result = await model.generateContent(`Responde curto em PT: ${message}`);
        res.json({ reply: result.response.text() });
    } catch (error) {
        res.status(500).json({ reply: "IA temporariamente indisponível." });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 MultiPower Online na porta ${port}`);
});