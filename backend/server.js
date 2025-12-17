const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require('path');
const { exec } = require('child_process');

const app = express();
const port = process.env.PORT || 3000;

// --- AUTO-INICIALIZAÇÃO DA BASE DE DADOS ---
// Resolve o problema da Shell paga no Render criando a BD no arranque
exec('node backend/init_db.js', (error, stdout, stderr) => {
    if (error) {
        console.error(`Erro ao iniciar DB: ${error.message}`);
        return;
    }
    console.log(`Mensagem do Sistema: ${stdout}`);
});

// Configuração Gemini (Chave via Variável de Ambiente para Segurança)
const GOOGLE_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyDBuFS2iujIr-P6ALX6CJ1RFc-Zx9upw5c"; 
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.use(cors());
app.use(express.json());

// Servir ficheiros estáticos da raiz (Onde estão os teus ficheiros .html)
app.use(express.static(path.join(__dirname, '../')));

// Rotas do Backend
const authRoutes = require('./routes/auth');
app.use('/api', authRoutes);

// Rota do Chat com IA
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        const prompt = `Tu és o assistente da MultiPower. Responde de forma curta e amigável em PT. Utilizador: ${message}`;
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        res.json({ reply: text });
    } catch (error) {
        console.error("Erro IA:", error);
        res.status(500).json({ reply: "Desculpa, estou com dificuldades técnicas. Tenta novamente!" });
    }
});

// IP 0.0.0.0 é obrigatório para o Render
app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor MultiPower ativo na porta ${port}`);
});