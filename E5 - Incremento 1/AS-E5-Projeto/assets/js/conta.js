document.addEventListener('DOMContentLoaded', function () {
    const email = 'cliente@multipower.pt'; // Fixo para demo
    localStorage.setItem('email', email);

    // Inicializar dados
    carregarPerfil(email);
    carregarGaragem(email);
    
    // Configurar submissão do formulário de carro
    setupAddCarForm(email);
});

/* --- LÓGICA DE DADOS --- */

async function carregarPerfil(email) {
    try {
        const res = await fetch(`http://localhost:3000/api/perfil/${email}`);
        const user = await res.json();
        
        if (user.nome) {
            // Atualiza Header
            document.querySelector('.profile-name').textContent = `${user.nome} ${user.apelido || ''}`;
            document.querySelector('.profile-email').textContent = user.email;
            
            // Atualiza Gamification
            document.getElementById('co2-val').textContent = user.co2_saved || 0;
            document.getElementById('points-val').textContent = user.points || 0;

            // Preenche formulário de edição (para quando o user abrir)
            document.getElementById('edit-email').value = user.email;
            document.getElementById('edit-phone').value = user.telefone || '';
            document.getElementById('edit-address').value = user.morada || '';
        }
    } catch(e) { console.error("Erro perfil:", e); }
}

async function carregarGaragem(email) {
    try {
        const res = await fetch(`http://localhost:3000/api/carros/${email}`);
        const carros = await res.json();
        const lista = document.getElementById('garage-list');
        
        lista.innerHTML = '';

        if (carros.length === 0) {
            lista.innerHTML = `
                <div style="background:#252525; padding:30px; border-radius:16px; text-align:center; border:1px dashed #444;">
                    <p style="color:#888;">A sua garagem está vazia.</p>
                    <button onclick="openAddCar()" class="btn-mini-add" style="margin-top:10px;">Adicionar Viatura</button>
                </div>`;
            return;
        }

        // Criar cartões modernos para cada carro
        carros.forEach(carro => {
            const div = document.createElement('div');
            div.className = 'car-card';
            
            // Determinar ícone e texto da ficha
            const isCCS = carro.connection_type == 33;
            const plugName = isCCS ? 'CCS 2' : 'Type 2';
            const plugColor = isCCS ? '#4bc0c0' : '#f39c12'; // Verde ou Laranja

            div.innerHTML = `
                <div class="car-icon-box">🚗</div>
                <div class="car-info">
                    <span class="car-name">${carro.marca} ${carro.modelo}</span>
                    <div class="car-meta">
                        <span class="car-tag">${carro.matricula}</span>
                        <span class="car-tag">🔋 ${carro.battery_size} kWh</span>
                        <span class="car-tag" style="color:${plugColor}">⚡ ${plugName}</span>
                    </div>
                </div>
                <button class="btn-delete" onclick="removerCarro(${carro.id})">✕</button>
            `;
            lista.appendChild(div);
        });

    } catch(e) { console.error("Erro garagem:", e); }
}

function setupAddCarForm(email) {
    const form = document.getElementById('add-car-form');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Transformar FormData em Objeto JSON
        const data = Object.fromEntries(new FormData(form).entries());
        data.email = email; // Adicionar email manualmente

        try {
            const response = await fetch('http://localhost:3000/api/adicionar-carro', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                form.reset();
                closeAllSheets(); // Fecha o menu deslizante
                carregarGaragem(email); // Atualiza a lista visual
                alert("Viatura adicionada com sucesso!");
            } else {
                alert("Erro ao adicionar viatura.");
            }
        } catch (error) {
            console.error(error);
        }
    });
}

async function removerCarro(id) {
    if(!confirm("Tem a certeza que deseja remover esta viatura?")) return;
    
    await fetch('http://localhost:3000/api/remover-carro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
    });
    carregarGaragem(localStorage.getItem('email'));
}

/* --- INTERFACE: BOTTOM SHEETS --- */

// Funções globais para abrir os menus
window.openAddCar = () => openSheet('sheet-add-car');
window.openEditProfile = () => openSheet('sheet-profile');

window.openTransactions = () => {
    const container = document.getElementById('reservations-container');
    // Simulação de dados (podes ligar à API depois)
    container.innerHTML = `
        <div style="background:#252525; padding:15px; border-radius:12px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <div style="font-weight:bold; color:#fff;">Carregamento Rápido</div>
                <div style="font-size:0.8em; color:#888;">Ontem, 18:30 • Brooklyn Station</div>
            </div>
            <div style="color:#e74c3c; font-weight:bold;">-12.50€</div>
        </div>
        <div style="background:#252525; padding:15px; border-radius:12px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <div style="font-weight:bold; color:#fff;">Reserva Cancelada</div>
                <div style="font-size:0.8em; color:#888;">10 Dez • Supercharger</div>
            </div>
            <div style="color:#aaa;">0.00€</div>
        </div>
    `;
    openSheet('sheet-transactions');
}

// Lógica Genérica de Abertura/Fecho
function openSheet(id) {
    document.getElementById('overlay').classList.add('active');
    document.getElementById(id).classList.add('active');
}

window.closeAllSheets = function() {
    document.getElementById('overlay').classList.remove('active');
    document.querySelectorAll('.bottom-sheet').forEach(el => {
        el.classList.remove('active');
    });
}

// Tornar funções globais para o HTML conseguir chamar
window.removerCarro = removerCarro;