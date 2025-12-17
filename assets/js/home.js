document.addEventListener('DOMContentLoaded', async () => {
    const email = localStorage.getItem('email') || 'cliente@multipower.pt';
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    const dataHoje = new Date().toLocaleDateString('pt-PT', options);
    document.getElementById('current-date').textContent = dataHoje.charAt(0).toUpperCase() + dataHoje.slice(1);

    await carregarDadosUsuario(email);
    renderMarketChart();
    renderNews();
});

async function carregarDadosUsuario(email) {
    try {
        // CORREÇÃO: Removido localhost
        const resPerfil = await fetch(`/api/perfil/${email}`);
        const user = await resPerfil.json();
        if(user.nome) {
            document.getElementById('user-greeting').textContent = `Olá, ${user.nome}!`;
            document.getElementById('co2-val').textContent = (user.co2_saved || 0).toFixed(1);
        }

        // CORREÇÃO: Removido localhost
        const resWallet = await fetch(`/api/wallet/${email}`);
        const wallet = await resWallet.json();
        document.getElementById('wallet-val').textContent = `${(wallet.saldo || 0).toFixed(2)}€`;

    } catch(e) { console.error("Erro dados:", e); }
}

function renderMarketChart() {
    const ctx = document.getElementById('marketChart');
    if(!ctx) return;
    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, 'rgba(75, 192, 192, 0.4)');
    gradient.addColorStop(1, 'rgba(75, 192, 192, 0.0)');

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['00h', '04h', '08h', '12h', '16h', '20h', '23h'],
            datasets: [{
                label: '€/MWh',
                data: [45, 30, 80, 110, 60, 120, 90],
                borderColor: '#4bc0c0',
                backgroundColor: gradient,
                borderWidth: 2,
                pointRadius: 0,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#666', font:{size:10} }, grid: { display: false } },
                y: { ticks: { color: '#666', font:{size:10} }, grid: { color: '#333' } }
            }
        }
    });
}

function renderNews() {
    const feed = document.getElementById('news-feed');
    const newsData = [
        {
            source: "CNN Portugal",
            title: "Carregamentos elétricos ficam 15% mais baratos em 2025",
            date: "Há 2h",
            img: "https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=400&q=60"
        },
        {
            source: "Automóvel Online",
            title: "Novos Superchargers instalados na A1 sentido Norte-Sul",
            date: "Há 5h",
            img: "https://images.unsplash.com/photo-1566008885218-90abf9200ddb?auto=format&fit=crop&w=400&q=60"
        }
    ];

    feed.innerHTML = newsData.map(n => `
        <div class="news-item">
            <div class="news-img" style="background-image: url('${n.img}')"></div>
            <div class="news-content">
                <div class="news-header">
                    <span class="news-source">${n.source}</span>
                    <span class="news-date">${n.date}</span>
                </div>
                <div class="news-title">${n.title}</div>
            </div>
        </div>
    `).join('');
}