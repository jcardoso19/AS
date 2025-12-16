const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'db/users.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // 1. Utilizadores
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT, apelido TEXT, email TEXT UNIQUE, telefone TEXT,
    morada TEXT, password TEXT, 
    co2_saved REAL DEFAULT 0, points INTEGER DEFAULT 0
  )`);

  // 2. Carteira
  db.run(`CREATE TABLE IF NOT EXISTS wallets (
    user_id INTEGER PRIMARY KEY,
    saldo REAL DEFAULT 0.00,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  // 3. Carros
  db.run(`CREATE TABLE IF NOT EXISTS cars (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    marca TEXT, modelo TEXT, ano TEXT, matricula TEXT, cor TEXT,
    battery_size REAL DEFAULT 50.0, 
    connection_type INTEGER DEFAULT 33, 
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  // 4. HISTÓRICO DE TRANSAÇÕES (NOVO)
  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    tipo TEXT, -- 'Reserva', 'Carregamento', 'Saldo'
    estacao TEXT,
    valor REAL,
    data DATETIME DEFAULT CURRENT_TIMESTAMP,
    detalhes TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  // Dados de Exemplo
  db.run(`INSERT OR IGNORE INTO users (nome, email, password, co2_saved, points) VALUES ('Cliente', 'cliente@multipower.pt', '1234', 120.5, 500)`);
  
  db.get("SELECT id FROM users WHERE email = 'cliente@multipower.pt'", (err, user) => {
    if(user) {
      db.run(`INSERT OR IGNORE INTO wallets (user_id, saldo) VALUES (?, 50.00)`, [user.id]);
      db.run(`INSERT INTO cars (user_id, marca, modelo, ano, matricula, cor, battery_size, connection_type) 
              SELECT ?, 'Tesla', 'Model 3', '2023', 'AA-00-EV', 'Branco', 75.0, 33
              WHERE NOT EXISTS (SELECT 1 FROM cars WHERE user_id = ?)`, [user.id, user.id]);
    }
  });

  console.log("Base de dados recriada com tabela de Transações!");
});