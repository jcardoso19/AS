document.addEventListener('DOMContentLoaded', () => {
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const chatContainer = document.getElementById('chat-container');

    // Função para adicionar mensagem ao ecrã
    function addMessage(text, sender) {
        const div = document.createElement('div');
        div.className = `message ${sender === 'user' ? 'user-message' : 'ai-message'}`;
        div.innerHTML = text; // Usa innerHTML para permitir quebras de linha <br>
        chatContainer.appendChild(div);
        chatContainer.scrollTop = chatContainer.scrollHeight; // Auto-scroll para o fundo
    }

    // Função para enviar mensagem
    async function sendMessage() {
        const text = userInput.value.trim();
        if (!text) return;

        // 1. Mostra a mensagem do utilizador
        addMessage(text, 'user');
        userInput.value = '';

        // 2. Mostra indicador de "a escrever..."
        const loadingId = 'loading-' + Date.now();
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'message ai-message';
        loadingDiv.id = loadingId;
        loadingDiv.innerText = '...';
        chatContainer.appendChild(loadingDiv);

        try {
            // Tenta chamar o teu backend (ajusta a rota se for diferente)
            const response = await fetch('http://localhost:3000/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });

            // Remove o indicador de loading
            document.getElementById(loadingId).remove();

            if (!response.ok) {
                // Se der erro 503 ou outro, lança erro para o catch
                throw new Error(`Erro API: ${response.status}`);
            }

            const data = await response.json();
            addMessage(data.reply, 'ai');

        } catch (error) {
            // REMOVE o loading se ainda existir
            const loadingEl = document.getElementById(loadingId);
            if(loadingEl) loadingEl.remove();

            console.error("Erro no chat:", error);

            // RESPOSTA DE ERRO AMIGÁVEL
            if (error.message.includes('503')) {
                addMessage("⚠️ Os meus servidores estão com muito tráfego agora. Podes tentar daqui a 30 segundos?", 'ai');
            } else {
                // Fallback para outros erros (ex: servidor desligado)
                addMessage("⚠️ Não consegui ligar ao servidor. Verifica a tua conexão.", 'ai');
            }
        }
    }

    // Event Listeners
    sendBtn.addEventListener('click', sendMessage);
    
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
});