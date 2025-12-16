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

            // --- GRÁFICO 1: CONSUMO MENSAL (BARRAS) ---
            const monthlyCtx = document.getElementById('monthlyChart').getContext('2d');
            new Chart(monthlyCtx, {
                type: 'bar',
                data: {
                    labels: monthlyLabels,
                    datasets: [{
                        label: 'Consumo Mensal (kWh)',
                        data: data.monthly_history,
                        /* MUDANÇA: Azul MultiPower */
                        backgroundColor: '#2563EB', 
                        borderRadius: 4 // Barras ligeiramente arredondadas ficam mais modernas
                    }]
                },
                options: {
                    responsive: false, // Mantém false se controlas o tamanho no canvas
                    plugins: { 
                        legend: { display: false } 
                    },
                    scales: { 
                        y: { 
                            beginAtZero: true,
                            grid: { color: '#e5e7eb' } // Linhas de grelha cinza claro
                        },
                        x: {
                            grid: { display: false } // Remove grelha vertical para ficar mais limpo
                        }
                    }
                }
            });

            // Gera valores de variação de preços (€/kWh) realistas
            const priceHistory = Array.from({length: 12}, () => (Math.random() * 0.12 + 0.13).toFixed(3));

            // --- GRÁFICO 2: VARIAÇÃO DE PREÇO (LINHA) ---
            const yearlyCtx = document.getElementById('yearlyChart').getContext('2d');
            new Chart(yearlyCtx, {
                type: 'line',
                data: {
                    labels: monthlyLabels,
                    datasets: [{
                        label: 'Variação de Preço (€/kWh)',
                        data: priceHistory,
                        /* MUDANÇA: Azul claro transparente para o fundo */
                        backgroundColor: 'rgba(37, 99, 235, 0.15)', 
                        /* MUDANÇA: Azul forte para a linha */
                        borderColor: '#2563EB',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4, // Linha mais curva e suave
                        pointBackgroundColor: '#1E40AF', // Pontos azul escuro
                        pointRadius: 4
                    }]
                },
                options: {
                    responsive: false,
                    plugins: { 
                        legend: { 
                            display: true,
                            labels: { color: '#333' } // Texto da legenda escuro
                        } 
                    },
                    scales: {
                        y: {
                            beginAtZero: false,
                            min: 0.10,
                            max: 0.30,
                            grid: { color: '#e5e7eb' },
                            ticks: {
                                color: '#666',
                                callback: function(value) { return value + '€'; }
                            }
                        },
                        x: {
                            ticks: { color: '#666' },
                            grid: { display: false }
                        }
                    }
                }
            });

            // Lógica do botão adicionar saldo
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