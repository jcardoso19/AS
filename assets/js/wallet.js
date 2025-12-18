document.addEventListener('DOMContentLoaded', () => {
    // Tenta obter o email do utilizador logado, caso contrário usa o de teste
    const email = localStorage.getItem('email') || 'cliente@multipower.pt';
    carregarDadosWallet(email);
});

async function carregarDadosWallet(email) {
    // 1. Carregar Saldo
    try {
        // CORREÇÃO: Usar caminho relativo /api
        const resWallet = await fetch(`/api/wallet/${email}`);
        const wallet = await resWallet.json();
        document.getElementById('balance-display').textContent = `${(wallet.saldo || 0).toFixed(2)}€`;
    } catch(e) { 
        document.getElementById('balance-display').textContent = 'Erro';
        console.error("Erro ao carregar saldo:", e);
    }
    
    // 2. Carregar Transações
    try {
        // CORREÇÃO: Usar caminho relativo /api
        const resTrans = await fetch(`/api/transacoes/${email}`);
        if (!resTrans.ok) throw new Error("Falha ao buscar transações");
        const transacoes = await resTrans.json();
        renderTransacoes(transacoes);
    } catch(e) {
        document.getElementById('transactions-feed').innerHTML = `<p style="text-align:center; color:#e74c3c;">Erro ao ligar ao servidor.</p>`;
        console.error("Erro ao buscar transações:", e);
    }
}

function renderTransacoes(transacoes) {
    const feed = document.getElementById('transactions-feed');
    feed.innerHTML = '';
    
    if (transacoes.length === 0) {
        feed.innerHTML = `<p style="text-align:center; color:#666;">Sem movimentos registados.</p>`;
        return;
    }

    transacoes.forEach(t => {
        const isCredit = t.tipo === 'Carregamento' || t.valor > 0;
        const valorDisplay = Math.abs(t.valor).toFixed(2);
        
        let title = t.tipo;
        let details = t.detalhes || t.estacao;

        if (t.tipo === 'Reserva') {
            title = 'Reserva de Carregamento';
        } else if (t.tipo === 'Reembolso') {
            title = 'Reembolso';
        } else if (t.tipo === 'Carregamento') {
             title = 'Carregamento de Saldo';
             details = t.detalhes;
        }

        const item = document.createElement('div');
        item.className = 'transaction-item';
        
        item.innerHTML = `
            <div class="trans-info">
                <div class="trans-title">${isCredit ? '➕ ' : '⚡ '}${title}</div>
                <div class="trans-date">${details}</div>
            </div>
            <div class="trans-amount ${isCredit ? 'amount-credit' : 'amount-debit'}">
                ${isCredit ? '+' : '-'} ${valorDisplay}€
            </div>
        `;
        feed.appendChild(item);
    });
}

// --- NOVA FUNCIONALIDADE: ADICIONAR FUNDOS ---
window.addFunds = async function() {
    const valorInput = prompt("Quanto deseja carregar? (Ex: 25.00)");
    
    if (valorInput === null || valorInput.trim() === "") {
        return; 
    }

    const valor = parseFloat(valorInput.replace(',', '.'));
    
    if (isNaN(valor) || valor <= 0) {
        alert("Por favor, insira um valor numérico válido e positivo.");
        return;
    }
    
    const metodo = "MB WAY (Simulado)";
    
    if (!confirm(`Confirma o carregamento de ${valor.toFixed(2)}€ via ${metodo}?`)) {
        return;
    }

    try {
        // CORREÇÃO: Usar caminho relativo /api
        const response = await fetch('/api/adicionar-saldo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                email: localStorage.getItem('email'),
                valor: valor,
                metodo: metodo
            })
        });

        const res = await response.json();

        if (response.ok) {
            alert(`✅ Sucesso! Foram adicionados ${res.valor_adicionado.toFixed(2)}€ ao seu saldo.`);
            carregarDadosWallet(localStorage.getItem('email'));
        } else {
            alert("❌ Erro ao carregar saldo: " + (res.error || "Falha desconhecida."));
        }
    } catch(e) {
        console.error("Erro de comunicação ao carregar saldo:", e);
        alert("Erro de ligação ao servidor. Verifique a consola.");
    }
};