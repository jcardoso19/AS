const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();
const port = process.env.PORT || 10000;

// --- 1. GARANTIR PASTA DA BD (Síncrono) ---
// Usamos process.cwd() para apontar para a raiz do projeto no Render
const dbFolder = path.join(process.cwd(), 'db'); 
if (!fs.existsSync(dbFolder)) {
    fs.mkdirSync(dbFolder, { recursive: true });
    console.log("✅ Pasta 'db' criada na raiz.");
}

// --- 2. INICIALIZAR DADOS ---
exec('node backend/init_db.js', (err, stdout) => {
    if (err) console.error("Erro BD:", err);
    else console.log("BD Pronta:", stdout.trim());
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(process.cwd())));

// Rotas
const authRoutes = require('./routes/auth');
app.use('/api', authRoutes);

// Rota Chat IA
const GOOGLE_API_KEY = process.env.GEMINI_API_KEY || "A_TUA_CHAVE"; 
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
    console.log(`🚀 MultiPower Online na porta ${port}`);
});