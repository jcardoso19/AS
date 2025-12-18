const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();
const port = process.env.PORT || 10000;

// --- 1. GARANTIR PASTA DA BD NA RAIZ ---
// Usa process.cwd() para garantir que fica na raiz do projeto no Render
const dbFolder = path.join(process.cwd(), 'db');
if (!fs.existsSync(dbFolder)) {
    fs.mkdirSync(dbFolder, { recursive: true });
    console.log("✅ Pasta 'db' criada na raiz.");
}

// --- 2. INICIALIZAR DADOS ---
// Corre o script para criar tabelas e utilizador
exec('node backend/init_db.js', (err, stdout) => {
    if (err) console.error("Erro init_db:", err);
    else console.log("BD Pronta:", stdout.trim());
});

app.use(cors());
app.use(express.json());

// Servir ficheiros estáticos da raiz do projeto
app.use(express.static(process.cwd()));

// Carregar Rotas
const authRoutes = require('./routes/auth');
app.use('/api', authRoutes);

// Rota Chat IA
const GOOGLE_API_KEY = process.env.GEMINI_API_KEY || "A_TUA_CHAVE_AQUI"; 
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        const result = await model.generateContent(`Responde curto em PT: ${message}`);
        res.json({ reply: result.response.text() });
    } catch (e) { 
        res.status(500).json({ reply: "IA indisponível." }); 
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Servidor MultiPower Online na porta ${port}`);
});