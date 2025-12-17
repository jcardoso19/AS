const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();
const port = process.env.PORT || 10000; // Porta padrão do Render

// --- 1. GARANTIR PASTA DA BD NA RAIZ ---
// Como a imagem mostra a pasta 'db' na raiz, apontamos para lá
const dbFolder = path.join(__dirname, '../db'); 
if (!fs.existsSync(dbFolder)) {
    fs.mkdirSync(dbFolder, { recursive: true });
}

// --- 2. INICIALIZAR DADOS ---
exec('node backend/init_db.js', (err, stdout) => {
    if (err) console.error("Erro BD:", err);
    else console.log("BD Pronta:", stdout.trim());
});

app.use(cors());
app.use(express.json());

// Servir ficheiros estáticos da raiz do projeto
app.use(express.static(path.join(__dirname, '../')));

// Carregar Rotas
const authRoutes = require('./routes/auth');
app.use('/api', authRoutes);

// Rota Chat IA
const GOOGLE_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyCfRU64BtPjnSh6CVDyN4jKFEBmEz5aUeQ"; 
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        const result = await model.generateContent(`Tu és o assistente da MultiPower. Responde curto em PT: ${message}`);
        res.json({ reply: result.response.text() });
    } catch (e) { 
        res.status(500).json({ reply: "IA temporariamente indisponível." }); 
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor MultiPower ativo na porta ${port}`);
});