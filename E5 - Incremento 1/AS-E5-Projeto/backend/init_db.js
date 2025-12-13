const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./db/users.db');

function generateRandomHistory() {
  // 12 valores aleatórios entre 20 e 100 (kWh)
  return JSON.stringify(Array.from({length: 12}, () => Math.floor(Math.random() * 81) + 20));
}

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      apelido TEXT NOT NULL,
      data_nascimento TEXT NOT NULL,
      genero TEXT NOT NULL,
      cartao_cidadao TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      telefone TEXT NOT NULL,
      morada TEXT NOT NULL,
      pais TEXT NOT NULL,
      cidade TEXT NOT NULL,
      codigo_postal TEXT NOT NULL,
      password TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS wallets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      saldo REAL NOT NULL,
      monthly_history TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // Insere admin se não existir
  db.run(`
    INSERT OR IGNORE INTO users 
      (nome, apelido, data_nascimento, genero, cartao_cidadao, email, telefone, morada, pais, cidade, codigo_postal, password, is_admin)
    VALUES 
      ('Administrador', 'Admin', '1970-01-01', 'Outro', '00000000', 'admin@multipower.pt', '000000000', 'Admin Street', 'Portugal', 'Aveiro', '0000-000', 'admin123', 1)
  `);
  // Insere Cliente Padrão
  db.run(`
    INSERT OR IGNORE INTO users 
      (nome, apelido, data_nascimento, genero, cartao_cidadao, email, telefone, morada, pais, cidade, codigo_postal, password, is_admin)
    VALUES 
      ('Cliente', 'Exemplo', '1990-01-01', 'Masculino', '11111111', 'cliente@multipower.pt', '910000000', 'Rua do Cliente', 'Portugal', 'Lisboa', '1000-000', '1234', 0)
  `);

  // Garante que o cliente tem carteira
  db.get("SELECT id FROM users WHERE email = 'cliente@multipower.pt'", (err, user) => {
      if(user) {
          db.run(`INSERT OR IGNORE INTO wallets (user_id, saldo, monthly_history) VALUES (?, ?, ?)`, 
          [user.id, 50.00, generateRandomHistory()]);
      }
  });

  // Cria carteiras para todos os utilizadores que ainda não têm
  db.all(`SELECT id FROM users`, [], (err, users) => {
    if (users && users.length > 0) {
      let pending = users.length;
      users.forEach(user => {
        db.run(`
          INSERT OR IGNORE INTO wallets (user_id, saldo, monthly_history)
          VALUES (?, ?, ?)
        `, [user.id, (Math.random() * 200).toFixed(2), generateRandomHistory()], () => {
          pending--;
          if (pending === 0) db.close();
        });
      });
    } else {
      db.close();
    }
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS carros (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      marca TEXT NOT NULL,
      modelo TEXT NOT NULL,
      ano TEXT NOT NULL,
      matricula TEXT NOT NULL,
      cor TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS carro_estacao (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      carro_id INTEGER NOT NULL,
      estacao_id TEXT NOT NULL,
      status TEXT NOT NULL, -- 'reservado' ou 'iniciado'
      data TEXT,
      hora TEXT,
      cheguei INTEGER DEFAULT 0,
      lat REAL,
      lon REAL,
      endereco TEXT,
      UNIQUE(carro_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS manutencao (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      estacao_id TEXT NOT NULL,
      data_inicio TEXT NOT NULL,
      data_fim TEXT,
      descricao TEXT,
      admin_email TEXT NOT NULL,
      UNIQUE(estacao_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS estacao_ocupacao (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      estacao_id TEXT NOT NULL,
      ocupados INTEGER DEFAULT 0,
      ultima_atualizacao DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS estacoes_locais (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      estacao_id TEXT UNIQUE NOT NULL,
      nome_estacao TEXT NOT NULL,
      nome_rua TEXT NOT NULL,
      numero_lugares INTEGER NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      data_criacao TEXT NOT NULL,
      admin_email TEXT NOT NULL
    )
  `);
});