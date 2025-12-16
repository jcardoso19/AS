const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../db/users.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error("Erro ao ligar à BD:", err.message);
});

// --- ROTA DE CANCELAMENTO (NOVA) ---
router.post('/cancelar-transacao', (req, res) => {
    const { id, user_email } = req.body;
    const TAXA_CANCELAMENTO = 1.50;

    db.get("SELECT id FROM users WHERE email = ?", [user_email], (err, user) => {
        if (!user) return res.status(404).json({ error: "User not found" });

        // 1. Procurar a transação original
        db.get("SELECT * FROM transactions WHERE id = ? AND user_id = ?", [id, user.id], (err, transacao) => {
            if (!transacao) return res.status(404).json({ error: "Transação não encontrada." });
            
            // Verificar se já foi cancelada ou se não é reserva
            if (transacao.detalhes.includes("[CANCELADO]")) {
                return res.status(400).json({ error: "Esta reserva já foi cancelada." });
            }
            if (transacao.tipo !== 'Reserva') {
                return res.status(400).json({ error: "Apenas reservas podem ser canceladas." });
            }

            // 2. Calcular Reembolso
            const valorOriginal = transacao.valor;
            const valorReembolso = valorOriginal - TAXA_CANCELAMENTO;

            if (valorReembolso < 0) {
                return res.status(400).json({ error: "O valor é demasiado baixo para reembolsar após a taxa." });
            }

            // 3. Atualizar Saldo (Devolve para a Wallet)
            db.run("UPDATE wallets SET saldo = saldo + ? WHERE user_id = ?", [valorReembolso, user.id], (err) => {
                if(err) return res.status(500).json({error: err.message});

                // 4. Marcar original como cancelada
                const novoDetalhe = transacao.detalhes + " [CANCELADO]";
                db.run("UPDATE transactions SET detalhes = ? WHERE id = ?", [novoDetalhe, id]);

                // 5. Criar registo de Reembolso no histórico
                const sqlReembolso = `INSERT INTO transactions (user_id, tipo, estacao, valor, detalhes) VALUES (?, ?, ?, ?, ?)`;
                const detalheReembolso = `Reembolso de reserva (Taxa ${TAXA_CANCELAMENTO.toFixed(2)}€)`;
                
                // Nota: O valor entra como negativo na visualização de "gasto", mas aqui queremos mostrar que entrou dinheiro.
                // Na lógica de visualização, se for 'Reembolso', vamos pintar de verde.
                // Na tabela transactions, guardamos o valor absoluto ou negativo dependendo da logica. 
                // Vamos guardar como 0 ou negativo para não somar aos gastos, mas visualmente tratamos no JS.
                
                db.run(sqlReembolso, [user.id, 'Reembolso', transacao.estacao, -valorReembolso, detalheReembolso], function(err) {
                    res.json({ success: true, reembolso: valorReembolso });
                });
            });
        });
    });
});

// --- OUTRAS ROTAS EXISTENTES (MANTIDAS) ---

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

// --- ROTA DE PAGAMENTO E RESERVA ---
router.post('/confirmar-pagamento', (req, res) => {
    const { email, estacao, valor, tempo_chegada, kwh_estimado, metodo } = req.body; // Recebe o método

    db.get("SELECT id FROM users WHERE email = ?", [email], (err, user) => {
        if (!user) return res.status(404).json({ error: "Utilizador não encontrado" });

        // Função auxiliar para gravar histórico e finalizar
        const finalizarReserva = (saldoAtual) => {
            // Adiciona o método de pagamento aos detalhes
            const nomeMetodo = metodo === 'app' ? 'Carteira' : metodo.toUpperCase();
            const detalhes = `${kwh_estimado} kWh • ${nomeMetodo}`;
            
            const sqlTrans = `INSERT INTO transactions (user_id, tipo, estacao, valor, detalhes) VALUES (?, ?, ?, ?, ?)`;
            
            db.run(sqlTrans, [user.id, 'Reserva', estacao, valor, detalhes], function(err) {
                if (err) console.error("Erro histórico:", err);
                
                // Dar pontos pela reserva
                db.run("UPDATE users SET points = points + 50, co2_saved = co2_saved + 2.5 WHERE id = ?", [user.id]);
                
                res.json({ success: true, novo_saldo: saldoAtual });
            });
        };

        // LÓGICA DE PAGAMENTO
        if (metodo === 'app') {
            // Se for pela APP, verifica e desconta saldo
            db.get("SELECT saldo FROM wallets WHERE user_id = ?", [user.id], (err, wallet) => {
                if (!wallet || wallet.saldo < valor) {
                    return res.status(400).json({ error: "Saldo insuficiente na App." });
                }
                
                db.run("UPDATE wallets SET saldo = saldo - ? WHERE user_id = ?", [valor, user.id], (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    finalizarReserva(wallet.saldo - valor); // Envia saldo atualizado
                });
            });
        } else {
            // Se for MB WAY, PayPal, etc., assumimos sucesso externo e não mexemos no saldo da wallet
            db.get("SELECT saldo FROM wallets WHERE user_id = ?", [user.id], (err, wallet) => {
                finalizarReserva(wallet ? wallet.saldo : 0); // Mantém o saldo igual
            });
        }
    });
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