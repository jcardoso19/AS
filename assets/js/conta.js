document.addEventListener('DOMContentLoaded', function () {
    // --- MODO SEM LOGIN (Utilizador Fixo) ---
    const email = 'cliente@multipower.pt';
    localStorage.setItem('email', email); // Garante que o email fica salvo para o Mapa também

    console.log("Modo automático: Logado como " + email);

    carregarPerfil(email);
    carregarGaragem(email);
    setupAddCarForm(email);
});

async function carregarPerfil(email) {
    try {
        const res = await fetch(`/api/perfil/${email}`);
        const user = await res.json();
        
        // Se a API devolver o utilizador, preenchemos os dados
        if (user && user.nome) {
            document.querySelector('.profile-name').textContent = `${user.nome} ${user.apelido || ''}`;
            document.querySelector('.profile-email').textContent = user.email;
            document.getElementById('co2-val').textContent = user.co2_saved ? user.co2_saved.toFixed(1) : 0;
            document.getElementById('points-val').textContent = user.points || 0;
            
            const editEmail = document.getElementById('edit-email');
            if(editEmail) editEmail.value = user.email;
            const editPhone = document.getElementById('edit-phone');
            if(editPhone) editPhone.value = user.telefone || '';
        }
    } catch(e) { 
        console.error("Erro ao carregar perfil:", e);
        document.querySelector('.profile-name').textContent = "Cliente Demo";
    }
}

async function carregarGaragem(email) {
    try {
        const res = await fetch(`/api/carros/${email}`);
        const carros = await res.json();
        const lista = document.getElementById('garage-list');
        lista.innerHTML = '';

        if (!carros || carros.length === 0) {
            lista.innerHTML = `<div style="background:#252525; padding:20px; border-radius:12px; text-align:center; color:#888;">Garagem vazia.</div>`;
            return;
        }

        carros.forEach(carro => {
            const div = document.createElement('div');
            div.className = 'car-card';
            const isCCS = carro.connection_type == 33;
            const plugName = isCCS ? 'CCS 2' : 'Type 2';
            const plugColor = isCCS ? '#4bc0c0' : '#f39c12';

            div.innerHTML = `
                <div class="car-icon-box">🚗</div>
                <div class="car-info">
                    <span class="car-name">${carro.marca} ${carro.modelo}</span>
                    <div class="car-meta">
                        <span class="car-tag">${carro.matricula}</span>
                        <span class="car-tag">🔋 ${carro.battery_size} kWh</span>
                        <span class="car-tag" style="color:${plugColor}">${plugName}</span>
                    </div>
                </div>
                <button class="btn-delete" onclick="removerCarro(${carro.id})">✕</button>
            `;
            lista.appendChild(div);
        });
    } catch(e) { console.error("Erro ao carregar garagem:", e); }
}

window.openTransactions = async function() {
    const container = document.getElementById('reservations-container');
    container.innerHTML = '<p style="text-align:center; color:#888;">A carregar histórico...</p>';
    
    openSheet('sheet-transactions'); 

    try {
        const email = localStorage.getItem('email');
        const res = await fetch(`/api/transacoes/${email}`);
        const transacoes = await res.json();

        container.innerHTML = '';

        if (!transacoes || transacoes.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#888; margin-top:20px;">Sem movimentos.</p>';
            return;
        }

        transacoes.forEach(t => {
            const isRefund = t.tipo === 'Reembolso' || (t.detalhes && (t.detalhes.includes('Cancelada') || t.detalhes.includes('CANCELADO')));
            const isCancelled = t.detalhes && t.detalhes.includes('[CANCELADO]');
            const isCharge = t.tipo === 'Carregamento';

            let valorClass = isCharge ? 'text-green' : 'text-red';
            if (isCancelled) valorClass = 'text-green'; 

            let valorSinal = isCharge || isCancelled ? '+' : '-';
            let valorDisplay = Math.abs(t.valor).toFixed(2);
            
            let icon = '⚡';
            let title = t.estacao || 'Reserva';
            
            if (isCharge) { title = 'Carregamento Saldo'; icon = '➕'; }
            if (isCancelled) { title += ' (Cancelada)'; icon = '🚫'; }

            let btnCancel = '';
            if (t.tipo === 'Reserva' && !isCancelled) {
                btnCancel = `<button onclick="cancelarReserva(${t.id})" class="btn-cancel-mini">Cancelar</button>`;
            }

            const item = document.createElement('div');
            item.className = 'trans-item';
            item.innerHTML = `
                <div class="trans-info">
                    <div class="trans-title">${icon} ${title}</div>
                    <div class="trans-date">${t.data || ''}</div>
                </div>
                <div class="trans-actions">
                    <div class="trans-price ${valorClass}">${valorSinal}${valorDisplay}€</div>
                    ${btnCancel}
                </div>
            `;
            container.appendChild(item);
        });

    } catch (e) {
        container.innerHTML = '<p style="color:#e74c3c; text-align:center;">Erro ao carregar histórico.</p>';
    }
}

window.cancelarReserva = async function(id) {
    if(!confirm("Deseja cancelar esta reserva? (Taxa: 1.50€)")) return;

    try {
        const response = await fetch('/api/cancelar-transacao', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                id: id, 
                user_email: localStorage.getItem('email') 
            })
        });

        const res = await response.json();

        if (response.ok) {
            alert(`✅ Cancelado. Reembolso: ${res.reembolso.toFixed(2)}€`);
            openTransactions(); 
            carregarPerfil(localStorage.getItem('email')); 
        } else {
            alert("Erro: " + (res.error || "Erro desconhecido"));
        }
    } catch(e) {
        alert("Erro de comunicação.");
    }
}

function setupAddCarForm(email) {
    const form = document.getElementById('add-car-form');
    if(!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(form).entries());
        data.email = email;
        
        try {
            const response = await fetch('/api/adicionar-carro', {
                method:'POST', 
                headers:{'Content-Type':'application/json'}, 
                body:JSON.stringify(data)
            });
            
            if(response.ok) {
                alert("Carro adicionado!");
                form.reset(); 
                closeAllSheets(); 
                carregarGaragem(email);
            } else {
                const err = await response.json();
                alert("Erro: " + (err.error || "Erro ao adicionar"));
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