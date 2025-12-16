const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// --- NOVO: Configuração do Gemini AI ---
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ATENÇÃO: Substitui "A_TUA_API_KEY_DO_GEMINI" pela tua chave real
// Podes obter uma em: https://aistudio.google.com/app/apikey
const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyBSLRJvDwLpAyfu3leyIVoXdXvqMczX0a4"; 
const genAI = new GoogleGenerativeAI(API_KEY);
// --------------------------------------

const dbPath = path.resolve(__dirname, '../db/users.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error("Erro ao ligar à BD:", err.message);
});

// --- ROTA DE CHAT (GEMINI AI) ---
router.post('/chat', async (req, res) => {
    try {
        const { message } = req.body;
        
        // CORREÇÃO: Usar 'gemini-1.5-flash' em vez de 'gemini-pro'
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        // Prompt de sistema para ele se comportar como assistente da MultiPower
        const prompt = `
            És o assistente virtual da aplicação MultiPower, uma app de gestão de carregamento de carros elétricos.
            O teu tom é prestável, curto e focado em energia sustentável.
            
            O utilizador disse: "${message}"
            
            Responde de forma concisa (máximo 2 frases).
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        res.json({ reply: text });
    } catch (error) {
        console.error("Erro Gemini:", error);
        // Retorna 503 se estiver sobrecarregado, ou 500 para outros erros
        if (error.message && error.message.includes('503')) {
            res.status(503).json({ error: "Serviço temporariamente indisponível" });
        } else {
            res.status(500).json({ error: "Erro interno no assistente" });
        }
    }
});

// --- ROTA DE CANCELAMENTO ---
router.post('/cancelar-transacao', (req, res) => {
    const { id, user_email } = req.body;
    const TAXA_CANCELAMENTO = 1.50;

    db.get("SELECT id FROM users WHERE email = ?", [user_email], (err, user) => {
        if (!user) return res.status(404).json({ error: "User not found" });

        db.get("SELECT * FROM transactions WHERE id = ? AND user_id = ?", [id, user.id], (err, transacao) => {
            if (!transacao) return res.status(404).json({ error: "Transação não encontrada." });
            
            if (transacao.detalhes.includes("[CANCELADO]")) {
                return res.status(400).json({ error: "Esta reserva já foi cancelada." });
            }
            if (transacao.tipo !== 'Reserva') {
                return res.status(400).json({ error: "Apenas reservas podem ser canceladas." });
            }

            const valorOriginal = Math.abs(transacao.valor); // Garante valor positivo
            const valorReembolso = valorOriginal - TAXA_CANCELAMENTO;

            if (valorReembolso < 0) {
                return res.status(400).json({ error: "O valor é demasiado baixo para reembolsar." });
            }

            // Atualizar Saldo
            db.run("UPDATE wallets SET saldo = saldo + ? WHERE user_id = ?", [valorReembolso, user.id], (err) => {
                if(err) return res.status(500).json({error: err.message});

                // Marcar como cancelada
                const novoDetalhe = transacao.detalhes + " [CANCELADO]";
                db.run("UPDATE transactions SET detalhes = ? WHERE id = ?", [novoDetalhe, id]);

                // Registar Reembolso
                const sqlReembolso = `INSERT INTO transactions (user_id, tipo, estacao, valor, detalhes) VALUES (?, ?, ?, ?, ?)`;
                const detalheReembolso = `Reembolso de reserva (Taxa ${TAXA_CANCELAMENTO.toFixed(2)}€)`;
                
                db.run(sqlReembolso, [user.id, 'Reembolso', transacao.estacao, valorReembolso, detalheReembolso], function(err) {
                    res.json({ success: true, reembolso: valorReembolso });
                });
            });
        });
    });
});

// --- ROTA DE PAGAMENTO ---
router.post('/confirmar-pagamento', (req, res) => {
    const { email, estacao, valor, tempo_chegada, kwh_estimado, metodo } = req.body;

    db.get("SELECT id FROM users WHERE email = ?", [email], (err, user) => {
        if (!user) return res.status(404).json({ error: "Utilizador não encontrado" });

        const finalizarReserva = (saldoAtual) => {
            const nomeMetodo = metodo === 'app' ? 'Carteira' : metodo.toUpperCase();
            const detalhes = `${kwh_estimado} kWh • ${nomeMetodo}`;
            
            const sqlTrans = `INSERT INTO transactions (user_id, tipo, estacao, valor, detalhes) VALUES (?, ?, ?, ?, ?)`;
            
            // Valor negativo para representar gasto
            db.run(sqlTrans, [user.id, 'Reserva', estacao, -valor, detalhes], function(err) {
                if (err) console.error("Erro histórico:", err);
                
                db.run("UPDATE users SET points = points + 50, co2_saved = co2_saved + 2.5 WHERE id = ?", [user.id]);
                res.json({ success: true, novo_saldo: saldoAtual });
            });
        };

        if (metodo === 'app') {
            db.get("SELECT saldo FROM wallets WHERE user_id = ?", [user.id], (err, wallet) => {
                if (!wallet || wallet.saldo < valor) {
                    return res.status(400).json({ error: "Saldo insuficiente na App." });
                }
                
                db.run("UPDATE wallets SET saldo = saldo - ? WHERE user_id = ?", [valor, user.id], (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    finalizarReserva(wallet.saldo - valor);
                });
            });
        } else {
            db.get("SELECT saldo FROM wallets WHERE user_id = ?", [user.id], (err, wallet) => {
                finalizarReserva(wallet ? wallet.saldo : 0);
            });
        }
    });
});

// --- ROTAS GERAIS ---
router.post('/adicionar-carro', (req, res) => {
    const { email, marca, modelo, ano, matricula, cor, battery_size, connection_type } = req.body;
    db.get("SELECT id FROM users WHERE email = ?", [email], (err, user) => {
        if (!user) return res.status(404).json({ error: "User not found" });
        const sql = `INSERT INTO cars (user_id, marca, modelo, ano, matricula, cor, battery_size, connection_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        const bat = battery_size || 50; const conn = connection_type || 33;
        db.run(sql, [user.id, marca, modelo, ano, matricula, cor, bat, conn], function(err) {
            res.json({ success: true, id: this.lastID });
        });
    });
});

router.get('/carros/:email', (req, res) => {
    const { email } = req.params;
    db.get("SELECT id FROM users WHERE email = ?", [email], (err, user) => {
        if (!user) return res.json([]);
        db.all("SELECT * FROM cars WHERE user_id = ?", [user.id], (err, rows) => res.json(rows));
    });
});

router.post('/remover-carro', (req, res) => {
    db.run("DELETE FROM cars WHERE id = ?", [req.body.id], (err) => res.json({ success: true }));
});

router.get('/transacoes/:email', (req, res) => {
    const { email } = req.params;
    db.get("SELECT id FROM users WHERE email = ?", [email], (err, user) => {
        if (!user) return res.json([]);
        db.all("SELECT * FROM transactions WHERE user_id = ? ORDER BY id DESC", [user.id], (err, rows) => {
            res.json(rows);
        });
    });
});

router.get('/perfil/:email', (req, res) => {
    db.get("SELECT * FROM users WHERE email = ?", [req.params.email], (err, row) => res.json(row || {}));
});

router.get('/wallet/:email', (req, res) => {
    db.get(`SELECT u.id, w.saldo FROM users u LEFT JOIN wallets w ON u.id = w.user_id WHERE u.email = ?`, [req.params.email], (err, row) => {
        res.json({ saldo: row ? row.saldo : 0 });
    });
});

router.get('/estado/:email', (req, res) => res.json({ ativo: false }));

module.exports = router;