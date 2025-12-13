# MultiPower – Plataforma de Gestão de Carregamento de Veículos Elétricos

## Equipa

- Tiago Pita - 120152
- Duarte Lourenço - 114421
- José Coelho - 120009
- Tiago Vieira - 119655

---

## Descrição

Aplicação web para gestão de estações de carregamento de veículos elétricos, reservas, carregamentos, pagamentos e administração de estações.

---

## Como experimentar a aplicação

### 1. Pré-requisitos

- Node.js (v22.15.0)
- npm (Node Package Manager)

### 2. Instalação

1. **Clonar o repositório ou copiar a pasta do projeto.**
2. **Instalar dependências do backend:**

   ```sh
   cd backend
   npm install
   ```

3. **Inicializar a base de dados (apenas na primeira vez):**

   ```sh
   node .\backend\init_db.js
   ```

4. **Iniciar o servidor backend:**

   - No Windows, pode usar o ficheiro:
     ```
     start-server.bat
     ```
   - Ou manualmente:
     ```sh
     node .\backend\server.js
     ```

5. **Abrir o frontend:**

   - Abrir o ficheiro `index.html` no browser (de preferência Chrome ou Edge).
   - **Nota:** Para funcionamento completo, abrir com um servidor local (ex: extensão Live Server do VS Code) para evitar restrições de CORS.

---

### 3. Logins de Teste

#### **Administrador**
- **Email:** admin@multipower.pt
- **Password:** admin123

#### **Utilizador de exemplo**
- Registe-se livremente na aplicação ou utilize um dos emails já registados (ver base de dados).
- **Email:** tiago@pita.pt
- **Password:** 4444
---

### 4. Funcionalidades principais

- Visualização de estações de carregamento no mapa (OpenChargeMap + locais)
- Reserva e início/término de carregamentos
- Gestão de saldo virtual e histórico de transações
- Gestão de veículos (garagem)
- Edição de dados pessoais e password
- Administração de estações locais e manutenção (apenas para admin)
