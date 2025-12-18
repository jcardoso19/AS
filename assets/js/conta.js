document.addEventListener('DOMContentLoaded', function () {
    // --- CONFIGURAÇÃO FIXA (SEM LOGIN) ---
    const emailFixo = 'cliente@multipower.pt';
    localStorage.setItem('email', emailFixo); // Guarda para o mapa usar também

    console.log("A iniciar app para: " + emailFixo);

    // Inicia tudo
    carregarPerfil(emailFixo);
    carregarGaragem(emailFixo);
    setupAddCarForm(emailFixo);
});

async function carregarPerfil(email) {
    try {
        // Agora o backend CRIA o user se ele não existir, por isso nunca falha
        const res = await fetch(`/api/perfil/${email}`);
        const user = await res.json();
        
        document.querySelector('.profile-name').textContent = `${user.nome} ${user.apelido}`;
        document.querySelector('.profile-email').textContent = user.email;
        
        // Atualiza campos de edição
        const editEmail = document.getElementById('edit-email');
        if(editEmail) editEmail.value = user.email;
        const editPhone = document.getElementById('edit-phone');
        if(editPhone) editPhone.value = user.telefone;

    } catch(e) { 
        console.error("Erro rede:", e);
        document.querySelector('.profile-name').textContent = "Erro de Ligação";
    }
}

async function carregarGaragem(email) {
    try {
        const res = await fetch(`/api/carros/${email}`);
        const carros = await res.json();
        const lista = document.getElementById('garage-list');
        lista.innerHTML = '';

        if (!carros || carros.length === 0) {
            lista.innerHTML = `<div style="text-align:center; padding:20px; color:#888;">Nenhum carro adicionado.</div>`;
            return;
        }

        carros.forEach(carro => {
            const div = document.createElement('div');
            div.className = 'car-card';
            div.innerHTML = `
                <div class="car-icon-box">🚗</div>
                <div class="car-info">
                    <span class="car-name">${carro.marca} ${carro.modelo}</span>
                    <div class="car-meta">
                        <span class="car-tag">${carro.matricula}</span>
                        <span class="car-tag">🔋 ${carro.battery_size} kWh</span>
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
    if(!form) return;

    // Remover clones antigos de eventos
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    newForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(newForm).entries());
        data.email = email; // Envia o email fixo
        
        try {
            const response = await fetch('/api/adicionar-carro', {
                method:'POST', 
                headers:{'Content-Type':'application/json'}, 
                body:JSON.stringify(data)
            });
            
            if(response.ok) {
                alert("✅ Carro adicionado com sucesso!");
                newForm.reset(); 
                closeAllSheets(); 
                carregarGaragem(email);
            } else {
                alert("Erro ao adicionar.");
            }
        } catch(e) { alert("Erro de comunicação."); }
    });
}

// Funções Globais (para funcionar nos onclicks do HTML)
window.removerCarro = async (id) => {
    if(confirm('Apagar este carro?')) {
        await fetch('/api/remover-carro', {
            method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id})
        });
        carregarGaragem(localStorage.getItem('email'));
    }
};

window.openTransactions = async function() {
    const container = document.getElementById('reservations-container');
    container.innerHTML = '<p style="text-align:center; color:#888;">A carregar...</p>';
    openSheet('sheet-transactions'); 

    const email = localStorage.getItem('email');
    const res = await fetch(`/api/transacoes/${email}`);
    const transacoes = await res.json();

    container.innerHTML = '';
    if(!transacoes.length) {
        container.innerHTML = '<p style="text-align:center; padding:20px;">Sem histórico.</p>';
        return;
    }

    transacoes.forEach(t => {
        const div = document.createElement('div');
        div.className = 'trans-item';
        div.style.cssText = "display:flex; justify-content:space-between; padding:15px; border-bottom:1px solid #333;";
        div.innerHTML = `
            <div>
                <div style="font-weight:bold; color:white;">${t.estacao || 'Carregamento'}</div>
                <div style="font-size:12px; color:#888;">${t.detalhes}</div>
            </div>
            <div style="color:${t.tipo==='Carregamento' ? '#4bc0c0' : '#ff6b6b'}; font-weight:bold;">
                ${t.valor}€
            </div>
        `;
        container.appendChild(div);
    });
}

window.openAddCar = () => openSheet('sheet-add-car');
window.openEditProfile = () => openSheet('sheet-profile');
window.closeAllSheets = () => {
    document.getElementById('overlay').classList.remove('active');
    document.querySelectorAll('.bottom-sheet').forEach(el => el.classList.remove('active'));
}

function openSheet(id) {
    document.getElementById('overlay').classList.add('active');
    document.getElementById(id).classList.add('active');
}