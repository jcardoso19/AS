document.addEventListener('DOMContentLoaded', function () {
    // --- MODO AUTOMÁTICO (Sem Login) ---
    const emailFixo = 'cliente@multipower.pt';
    
    // Forçar sempre este email
    localStorage.setItem('email', emailFixo);
    console.log("Sessão iniciada automaticamente para: " + emailFixo);

    // Carregar dados
    carregarPerfil(emailFixo);
    carregarGaragem(emailFixo);
    setupAddCarForm(emailFixo);
});

async function carregarPerfil(email) {
    try {
        const res = await fetch(`/api/perfil/${email}`);
        const user = await res.json();
        
        // Preencher dados na página
        if (user && user.nome) {
            document.querySelector('.profile-name').textContent = `${user.nome} ${user.apelido || ''}`;
            document.querySelector('.profile-email').textContent = user.email;
            document.getElementById('co2-val').textContent = user.co2_saved ? user.co2_saved.toFixed(1) : 0;
            document.getElementById('points-val').textContent = user.points || 0;
            
            const editEmail = document.getElementById('edit-email');
            if(editEmail) editEmail.value = user.email;
        } else {
            // Se o user não existir na BD (ex: reset do Render), mostra isto
            document.querySelector('.profile-name').textContent = "Cliente Demo";
            document.querySelector('.profile-email').textContent = email;
        }
    } catch(e) { 
        console.error("Erro perfil:", e);
    }
}

async function carregarGaragem(email) {
    try {
        const res = await fetch(`/api/carros/${email}`);
        const carros = await res.json();
        const lista = document.getElementById('garage-list');
        lista.innerHTML = '';

        if (!carros || carros.length === 0) {
            lista.innerHTML = `<div style="background:#252525; padding:20px; border-radius:12px; text-align:center; color:#888;">Ainda sem carros.</div>`;
            return;
        }

        carros.forEach(carro => {
            const div = document.createElement('div');
            div.className = 'car-card';
            const isCCS = carro.connection_type == 33;
            
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

window.openTransactions = async function() {
    const container = document.getElementById('reservations-container');
    container.innerHTML = '<p style="text-align:center; color:#888;">A atualizar...</p>';
    
    openSheet('sheet-transactions'); 

    try {
        const email = localStorage.getItem('email');
        const res = await fetch(`/api/transacoes/${email}`);
        const transacoes = await res.json();

        container.innerHTML = '';

        if (!transacoes || transacoes.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#888; margin-top:20px;">Sem histórico.</p>';
            return;
        }

        transacoes.forEach(t => {
            const isCancelled = t.detalhes && t.detalhes.includes('[CANCELADO]');
            const isCharge = t.tipo === 'Carregamento';
            
            let valorClass = isCharge ? 'text-green' : 'text-red';
            if (isCancelled) valorClass = 'text-green'; 

            let icon = isCharge ? '➕' : '⚡';
            let title = t.estacao || 'Movimento';
            if (isCancelled) { title += ' (Cancelado)'; icon = '🚫'; }

            const item = document.createElement('div');
            item.className = 'trans-item';
            item.innerHTML = `
                <div class="trans-info">
                    <div class="trans-title">${icon} ${title}</div>
                    <div class="trans-date">${t.detalhes || ''}</div>
                </div>
                <div class="trans-actions">
                    <div class="trans-price ${valorClass}">${Math.abs(t.valor).toFixed(2)}€</div>
                    ${(t.tipo === 'Reserva' && !isCancelled) ? `<button onclick="cancelarReserva(${t.id})" class="btn-cancel-mini">X</button>` : ''}
                </div>
            `;
            container.appendChild(item);
        });
    } catch (e) { container.innerHTML = '<p>Erro ao carregar.</p>'; }
}

window.cancelarReserva = async function(id) {
    if(!confirm("Cancelar reserva?")) return;
    try {
        await fetch('/api/cancelar-transacao', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id, user_email: localStorage.getItem('email') })
        });
        openTransactions(); 
        carregarPerfil(localStorage.getItem('email')); 
    } catch(e) { alert("Erro de ligação."); }
}

function setupAddCarForm(email) {
    const form = document.getElementById('add-car-form');
    if(!form) return;
    
    // Remove listeners antigos para evitar duplicação
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    newForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(newForm).entries());
        data.email = email;
        
        try {
            const response = await fetch('/api/adicionar-carro', {
                method:'POST', 
                headers:{'Content-Type':'application/json'}, 
                body:JSON.stringify(data)
            });
            
            if(response.ok) {
                alert("Carro guardado com sucesso!");
                newForm.reset(); 
                closeAllSheets(); 
                carregarGaragem(email);
            } else {
                alert("Erro ao guardar. Tente novamente.");
            }
        } catch(e) { alert("Erro de ligação."); }
    });
}

window.removerCarro = async (id) => {
    if(confirm('Apagar carro?')) {
        await fetch('/api/remover-carro', {
            method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id})
        });
        carregarGaragem(localStorage.getItem('email'));
    }
};

window.openAddCar = () => openSheet('sheet-add-car');
window.openEditProfile = () => openSheet('sheet-profile');

function openSheet(id) {
    document.getElementById('overlay').classList.add('active');
    document.getElementById(id).classList.add('active');
}
window.closeAllSheets = () => {
    document.getElementById('overlay').classList.remove('active');
    document.querySelectorAll('.bottom-sheet').forEach(el => el.classList.remove('active'));
}