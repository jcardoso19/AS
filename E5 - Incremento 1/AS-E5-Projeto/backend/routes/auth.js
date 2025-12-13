const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const router = express.Router();

const db = new sqlite3.Database('./db/users.db');

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  db.get(
    'SELECT * FROM users WHERE email = ? AND password = ?',
    [email, password],
    (err, user) => {
        if (err) return res.status(500).json({ error: 'Erro no servidor' });
        if (!user) return res.status(401).json({ error: 'Membro não encontrado' });
        res.json({ id: user.id, email: user.email, nome: user.nome, is_admin: !!user.is_admin });
    }
  );
});

router.post('/register', (req, res) => {
    const {
        nome, apelido, data_nascimento, genero, cartao_cidadao,
        email, telefone, morada, pais, cidade, codigo_postal, password
    } = req.body;

    if (!nome || !apelido || !data_nascimento || !genero || !cartao_cidadao ||
        !email || !telefone || !morada || !pais || !cidade || !codigo_postal || !password) {
        return res.status(400).json({ error: 'Campos obrigatórios em falta' });
    }

    db.run(
        `INSERT INTO users 
        (nome, apelido, data_nascimento, genero, cartao_cidadao, email, telefone, morada, pais, cidade, codigo_postal, password, is_admin)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [nome, apelido, data_nascimento, genero, cartao_cidadao, email, telefone, morada, pais, cidade, codigo_postal, password],
        function (err) {
            if (err) {
                if (err.code === 'SQLITE_CONSTRAINT') {
                    return res.status(409).json({ error: 'Email já registado' });
                }
                return res.status(500).json({ error: 'Erro no servidor' });
            }
            // Cria carteira para o novo utilizador
            const userId = this.lastID;
            const saldo = (Math.random() * 200).toFixed(2);
            const monthly_history = JSON.stringify(Array.from({ length: 12 }, () => Math.floor(Math.random() * 81) + 20));
            db.run(
                `INSERT INTO wallets (user_id, saldo, monthly_history) VALUES (?, ?, ?)`,
                [userId, saldo, monthly_history],
                function (err2) {
                    if (err2) {
                        return res.status(500).json({ error: 'Erro ao criar carteira' });
                    }
                    res.status(201).json({ id: userId, email });
                }
            );
        }
    );
    // console.log(req.body); // (opcional para debug)
});

router.get('/wallet/:email', (req, res) => {
    const email = req.params.email;
    db.get(
        `SELECT w.saldo, w.monthly_history 
         FROM wallets w
         JOIN users u ON w.user_id = u.id
         WHERE u.email = ?`,
        [email],
        (err, wallet) => {
            if (err) return res.status(500).json({ error: 'Erro no servidor' });
            if (!wallet) return res.status(404).json({ error: 'Carteira não encontrada' });
            res.json({
                saldo: wallet.saldo,
                monthly_history: JSON.parse(wallet.monthly_history)
            });
        }
    );
});

router.get('/user/:email', (req, res) => {
    const email = req.params.email;
    db.get(
        `SELECT nome, apelido, data_nascimento, genero, cartao_cidadao, email, telefone, morada, pais, cidade, codigo_postal 
         FROM users WHERE email = ?`,
        [email],
        (err, user) => {
            if (err) return res.status(500).json({ error: 'Erro no servidor' });
            if (!user) return res.status(404).json({ error: 'Utilizador não encontrado' });
            res.json(user);
        }
    );
});

// Atualizar dados do utilizador (exceto password)
router.put('/user/update', (req, res) => {
    const { email, telefone, morada, cidade, codigo_postal, pais, old_email } = req.body;
    db.run(
        `UPDATE users SET email=?, telefone=?, morada=?, cidade=?, codigo_postal=?, pais=? WHERE email=?`,
        [email, telefone, morada, cidade, codigo_postal, pais, old_email],
        function (err) {
            if (err) return res.status(500).json({ error: 'Erro ao atualizar dados' });
            res.json({ success: true });
        }
    );
});

// Atualizar password
router.put('/user/password', (req, res) => {
    const { email, password } = req.body;
    db.run(
        `UPDATE users SET password=? WHERE email=?`,
        [password, email],
        function (err) {
            if (err) return res.status(500).json({ error: 'Erro ao atualizar password' });
            res.json({ success: true });
        }
    );
});

// Tabela para histórico de carregamentos (se ainda não existir, cria em init_db.js)
db.run(`
    CREATE TABLE IF NOT EXISTS carregamentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        valor REAL NOT NULL,
        data_hora TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )
`);

// Adicionar saldo e registar carregamento (apenas se for input do utilizador)
router.post('/wallet/add', (req, res) => {
    const { email, valor, registar } = req.body;
    db.get('SELECT id FROM users WHERE email = ?', [email], (err, user) => {
        if (err || !user) return res.status(400).json({ error: 'Utilizador não encontrado' });
        db.run('UPDATE wallets SET saldo = saldo + ? WHERE user_id = ?', [valor, user.id], function (err2) {
            if (err2) return res.status(500).json({ error: 'Erro ao adicionar saldo' });
            // Só regista carregamento se registar=true
            if (registar) {
                const data_hora = new Date().toISOString();
                db.run('INSERT INTO carregamentos (user_id, valor, data_hora) VALUES (?, ?, ?)', [user.id, valor, data_hora]);
            }
            res.json({ success: true });
        });
    });
});

// Obter histórico de carregamentos
router.get('/carregamentos/:email', (req, res) => {
    const email = req.params.email;
    db.get('SELECT id FROM users WHERE email = ?', [email], (err, user) => {
        if (err || !user) return res.status(400).json({ error: 'Utilizador não encontrado' });
        db.all('SELECT valor, data_hora FROM carregamentos WHERE user_id = ? ORDER BY data_hora DESC', [user.id], (err2, rows) => {
            if (err2) return res.status(500).json({ error: 'Erro ao obter carregamentos' });
            res.json(rows);
        });
    });
});

// Adicionar carro
router.post('/carros/add', (req, res) => {
    const { email, marca, modelo, ano, matricula, cor } = req.body;
    db.get('SELECT id FROM users WHERE email = ?', [email], (err, user) => {
        if (err || !user) return res.status(400).json({ error: 'Utilizador não encontrado' });
        db.run(
            `INSERT INTO carros (user_id, marca, modelo, ano, matricula, cor) VALUES (?, ?, ?, ?, ?, ?)`,
            [user.id, marca, modelo, ano, matricula, cor],
            function (err2) {
                if (err2) return res.status(500).json({ error: 'Erro ao adicionar carro' });
                res.json({ success: true });
            }
        );
    });
});

// Listar carros do utilizador
router.get('/carros/:email', (req, res) => {
    const email = req.params.email;
    db.get('SELECT id FROM users WHERE email = ?', [email], (err, user) => {
        if (err || !user) return res.status(400).json({ error: 'Utilizador não encontrado' });
        db.all('SELECT id, marca, modelo, ano, matricula, cor FROM carros WHERE user_id = ?', [user.id], (err2, rows) => {
            if (err2) return res.status(500).json({ error: 'Erro ao obter carros' });
            res.json(rows);
        });
    });
});

// Remover carro
router.delete('/carros/remove', (req, res) => {
    const { email, carro_id } = req.body;
    db.get('SELECT id FROM users WHERE email = ?', [email], (err, user) => {
        if (err || !user) return res.status(400).json({ error: 'Utilizador não encontrado' });
        db.run('DELETE FROM carros WHERE id = ? AND user_id = ?', [carro_id, user.id], function (err2) {
            if (err2) return res.status(500).json({ error: 'Erro ao remover carro' });
            res.json({ success: true });
        });
    });
});

// Associar estação ao carro
router.post('/carro_estacao/add', (req, res) => {
  const { carro_id, estacao_id, status, data, hora, lat, lon, endereco } = req.body;
  // Só pode haver uma estação por carro
  db.run(
    `INSERT OR REPLACE INTO carro_estacao (carro_id, estacao_id, status, data, hora, lat, lon, endereco) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [carro_id, estacao_id, status, data, hora, lat, lon, endereco],
    function (err) {
      if (err) return res.status(500).json({ error: 'Erro ao associar estação' });
      res.json({ success: true });
    }
  );
});

// Remover associação
router.post('/carro_estacao/remove', (req, res) => {
  const { carro_id, estacao_id } = req.body;
  db.run(
    `DELETE FROM carro_estacao WHERE carro_id = ? AND estacao_id = ?`,
    [carro_id, estacao_id],
    function (err) {
      if (err) return res.status(500).json({ error: 'Erro ao remover associação' });
      res.json({ success: true });
    }
  );
});

// Obter estação associada ao carro
router.get('/carro_estacao/:carro_id', (req, res) => {
  const carro_id = req.params.carro_id;
  db.get(
    `SELECT * FROM carro_estacao WHERE carro_id = ?`,
    [carro_id],
    (err, row) => {
      if (err) return res.status(500).json({ error: 'Erro ao obter associação' });
      res.json(row);
    }
  );
});

// Endpoint ADMIN: Colocar estação em manutenção
router.post('/admin/manutencao/add', (req, res) => {
    const { estacao_id, descricao, admin_email } = req.body;

    // Verificar se é admin
    db.get('SELECT is_admin FROM users WHERE email = ?', [admin_email], (err, user) => {
        if (err || !user || !user.is_admin) {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const data_inicio = new Date().toISOString();
        db.run(
            `INSERT OR REPLACE INTO manutencao (estacao_id, data_inicio, descricao, admin_email) VALUES (?, ?, ?, ?)`,
            [estacao_id, data_inicio, descricao, admin_email],
            function (err) {
                if (err) return res.status(500).json({ error: 'Erro ao colocar em manutenção' });
                res.json({ success: true });
            }
        );
    });
});

// Endpoint ADMIN: Remover estação da manutenção
router.post('/admin/manutencao/remove', (req, res) => {
    const { estacao_id, admin_email } = req.body;

    // Verificar se é admin
    db.get('SELECT is_admin FROM users WHERE email = ?', [admin_email], (err, user) => {
        if (err || !user || !user.is_admin) {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const data_fim = new Date().toISOString();
        db.run(
            `UPDATE manutencao SET data_fim = ? WHERE estacao_id = ? AND data_fim IS NULL`,
            [data_fim, estacao_id],
            function (err) {
                if (err) return res.status(500).json({ error: 'Erro ao remover da manutenção' });
                res.json({ success: true });
            }
        );
    });
});

// Endpoint: Verificar se estação está em manutenção
router.get('/manutencao/:estacao_id', (req, res) => {
    const estacao_id = req.params.estacao_id;
    db.get(
        `SELECT * FROM manutencao WHERE estacao_id = ? AND data_fim IS NULL`,
        [estacao_id],
        (err, row) => {
            if (err) return res.status(500).json({ error: 'Erro ao verificar manutenção' });
            res.json({ em_manutencao: !!row, manutencao: row });
        }
    );
});

// Endpoint ADMIN: Listar todas as estações em manutenção
router.get('/admin/manutencao', (req, res) => {
    db.all(
        `SELECT * FROM manutencao WHERE data_fim IS NULL ORDER BY data_inicio DESC`,
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ error: 'Erro ao obter manutenções' });
            res.json(rows);
        }
    );
});

// === ENDPOINTS PARA ESTAÇÕES LOCAIS ===

// Endpoint ADMIN: Adicionar estação local
router.post('/admin/estacoes/add', (req, res) => {
    const { nome_estacao, nome_rua, numero_lugares, latitude, longitude, admin_email } = req.body;

    // Verificar se é admin
    db.get('SELECT is_admin FROM users WHERE email = ?', [admin_email], (err, user) => {
        if (err || !user || !user.is_admin) {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        // Validar campos obrigatórios
        if (!nome_estacao || !nome_rua || !numero_lugares || !latitude || !longitude) {
            return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
        }

        // Gerar ID único para a estação local (prefixo 'LOCAL_')
        const estacao_id = 'LOCAL_' + Date.now();
        const data_criacao = new Date().toISOString();

        db.run(
            `INSERT INTO estacoes_locais (estacao_id, nome_estacao, nome_rua, numero_lugares, latitude, longitude, data_criacao, admin_email) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [estacao_id, nome_estacao, nome_rua, numero_lugares, latitude, longitude, data_criacao, admin_email],
            function (err) {
                if (err) return res.status(500).json({ error: 'Erro ao adicionar estação local' });
                res.json({ success: true, estacao_id: estacao_id });
            }
        );
    });
});

// Endpoint ADMIN: Listar estações locais
router.get('/admin/estacoes', (req, res) => {
    db.all(
        `SELECT * FROM estacoes_locais ORDER BY data_criacao DESC`,
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ error: 'Erro ao obter estações locais' });
            res.json(rows);
        }
    );
});

// Endpoint ADMIN: Remover estação local
router.delete('/admin/estacoes/remove', (req, res) => {
    const { estacao_id, admin_email } = req.body;

    // Verificar se é admin
    db.get('SELECT is_admin FROM users WHERE email = ?', [admin_email], (err, user) => {
        if (err || !user || !user.is_admin) {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        db.run(
            `DELETE FROM estacoes_locais WHERE estacao_id = ?`,
            [estacao_id],
            function (err) {
                if (err) return res.status(500).json({ error: 'Erro ao remover estação local' });
                res.json({ success: true });
            }
        );
    });
});

// Endpoint: Obter estações locais na área
router.get('/estacoes_locais/area', (req, res) => {
    const { lat, lng, raio } = req.query;
    
    if (!lat || !lng || !raio) {
        return res.status(400).json({ error: 'Parâmetros lat, lng e raio são obrigatórios' });
    }

    // Buscar todas as estações locais (filtro por distância seria mais complexo, por agora retorna todas)
    db.all(
        `SELECT * FROM estacoes_locais`,
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ error: 'Erro ao obter estações locais' });
            res.json(rows);
        }
    );
});

// Endpoint dummy para teste de disponibilidade
router.get('/estacao_disponibilidade/test', (req, res) => {
    res.json({ ok: true });
});

module.exports = router;