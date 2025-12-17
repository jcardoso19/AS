document.addEventListener('DOMContentLoaded', function () {
    const email = 'cliente@multipower.pt';
    localStorage.setItem('email', email);

    carregarPerfil(email);
    carregarGaragem(email);
    setupAddCarForm(email);
});

async function carregarPerfil(email) {
    try {
        // CORREÇÃO: Removido localhost
        const res = await fetch(`/api/perfil/${email}`);
        const user = await res.json();
        if (user.nome) {
            document.querySelector('.profile-name').textContent = `${user.nome} ${user.apelido || ''}`;
            document.querySelector('.profile-email').textContent = user.email;
            document.getElementById('co2-val').textContent = user.co2_saved ? user.co2_saved.toFixed(1) : 0;
            document.getElementById('points-val').textContent = user.points || 0;
            document.getElementById('edit-email').value = user.email;
            document.getElementById('edit-phone').value = user.telefone || '';
        }
    } catch(e) { console.error("Erro ao carregar perfil:", e); }
}

async function carregarGaragem(email) {
    try {
        // CORREÇÃO: Removido localhost
        const res = await fetch(`/api/carros/${email}`);
        const carros = await res.json();
        const lista = document.getElementById('garage-list');
        lista.innerHTML = '';

        if (carros.length === 0) {
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
        // CORREÇÃO: Removido localhost
        const res = await fetch(`/api/transacoes/${email}`);
        const transacoes = await res.json();

        container.innerHTML = '';

        if (transacoes.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#888; margin-top:20px;">Sem movimentos.</p>';
            return;
        }

        transacoes.forEach(t => {
            const isRefund = t.tipo === 'Reembolso' || t.valor > 0;
            const isCancelled = t.detalhes.includes('[CANCELADO]');
            const isCharge = t.tipo === 'Carregamento';

            let valorClass = isRefund || isCharge ? 'text-green' : 'text-red';
            let valorSinal = isRefund || isCharge ? '+' : '-';
            let valorDisplay = Math.abs(t.valor).toFixed(2);
            
            let icon = '';
            let title = '';
            let details = t.detalhes;

            if (isCharge) {
                title = 'Carregamento de Saldo';
                icon = '➕';
                details = t.detalhes;
            } else if (t.tipo === 'Reembolso') {
                title = 'Reembolso de Reserva';
                icon = '↩️';
                details = t.detalhes;
            } else if (t.tipo === 'Reserva') {
                title = isCancelled ? 'Reserva Cancelada' : 'Reserva Ativa';
                icon = isCancelled ? '🚫' : '⚡';
                details = `${t.estacao} • ${t.detalhes.split(' • ')[0] || ''}`; 
                if (isCancelled) details = t.estacao + ' (Cancelada)';
            }
            
            let btnCancel = '';
            if (t.tipo === 'Reserva' && !isCancelled) {
                btnCancel = `<button onclick="cancelarReserva(${t.id})" class="btn-cancel-mini">Cancelar</button>`;
            }

            const item = document.createElement('div');
            item.className = 'trans-item';
            item.innerHTML = `
                <div class="trans-info">
                    <div class="trans-title">${icon} ${title}</div>
                    <div class="trans-date">${details}</div>
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
    if(!confirm("Deseja cancelar esta reserva?\n\nSerá devolvido ao saldo com uma taxa de 1.50€.")) return;

    try {
        // CORREÇÃO: Removido localhost
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
            alert(`✅ Reserva Cancelada.\nForam devolvidos ${res.reembolso.toFixed(2)}€ à sua carteira.`);
            openTransactions(); 
            carregarPerfil(localStorage.getItem('email')); 
        } else {
            alert("Erro: " + res.error);
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
        // CORREÇÃO: Removido localhost
        await fetch('/api/adicionar-carro', {
            method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)
        });
        form.reset(); closeAllSheets(); carregarGaragem(email);
    });
}

window.removerCarro = async (id) => {
    if(confirm('Apagar?')) {
        // CORREÇÃO: Removido localhost
        await fetch('/api/remover-carro', {
            method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id})
        });
        carregarGaragem(localStorage.getItem('email'));
    }
};

function openSheet(id) {
    document.getElementById('overlay').classList.add('active');
    document.getElementById(id).classList.add('active');
}
window.closeAllSheets = () => {
    document.getElementById('overlay').classList.remove('active');
    document.querySelectorAll('.bottom-sheet').forEach(el => el.classList.remove('active'));
}