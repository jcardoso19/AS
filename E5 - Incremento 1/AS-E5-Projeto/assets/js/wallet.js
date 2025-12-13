document.addEventListener('DOMContentLoaded', async function() {
    // Definir cliente fixo
    const email = 'cliente@multipower.pt';
    localStorage.setItem('email', email);
    
    try {
        const response = await fetch(`http://localhost:3000/api/wallet/${email}`);
        if (response.ok) {
            const data = await response.json();
            // Atualiza saldo
            document.querySelector('.wallet-balance').textContent = `${parseFloat(data.saldo).toFixed(2)}€`;

            // Labels para os meses
            const monthlyLabels = [
                'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
                'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
            ];

            // Atualiza gráfico mensal (Consumo)
            const monthlyCtx = document.getElementById('monthlyChart').getContext('2d');
            new Chart(monthlyCtx, {
                type: 'bar',
                data: {
                    labels: monthlyLabels,
                    datasets: [{
                        label: 'Consumo Mensal (kWh)',
                        data: data.monthly_history,
                        backgroundColor: '#4bc0c0'
                    }]
                },
                options: {
                    responsive: false,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true } }
                }
            });

            // Gera valores de variação de preços (€/kWh) realistas para cada mês (ex: 0.13€ a 0.25€)
            const priceHistory = Array.from({length: 12}, () => (Math.random() * 0.12 + 0.13).toFixed(3));

            // Atualiza gráfico de variação de preços
            const yearlyCtx = document.getElementById('yearlyChart').getContext('2d');
            new Chart(yearlyCtx, {
                type: 'line',
                data: {
                    labels: monthlyLabels,
                    datasets: [{
                        label: 'Variação de Preço (€/kWh)',
                        data: priceHistory,
                        backgroundColor: 'rgba(255,183,77,0.2)',
                        borderColor: '#ffb74d',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.3,
                        pointBackgroundColor: '#ffb74d'
                    }]
                },
                options: {
                    responsive: false,
                    plugins: { legend: { display: true } },
                    scales: {
                        y: {
                            beginAtZero: false,
                            min: 0.10,
                            max: 0.30,
                            ticks: {
                                callback: function(value) { return value + '€'; }
                            }
                        }
                    }
                }
            });

            const addBtn = document.getElementById('add-balance-btn');
            if (addBtn) {
                addBtn.onclick = async function () {
                    let valor = prompt("Quanto saldo deseja adicionar? (€)");
                    if (!valor) return;
                    valor = parseFloat(valor.replace(',', '.'));
                    if (isNaN(valor) || valor <= 0) {
                        alert("Valor inválido.");
                        return;
                    }
                    const email = localStorage.getItem('email');
                    const resp = await fetch('http://localhost:3000/api/wallet/add', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, valor })
                    });
                    if (resp.ok) {
                        alert("Saldo adicionado com sucesso!");
                        location.reload();
                    } else {
                        alert("Erro ao adicionar saldo.");
                    }
                };
            }

        } else {
            document.querySelector('.wallet-balance').textContent = 'Erro ao carregar saldo';
        }
    } catch (err) {
        document.querySelector('.wallet-balance').textContent = 'Erro de ligação';
    }
});