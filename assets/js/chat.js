document.addEventListener('DOMContentLoaded', () => {
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const chatContainer = document.getElementById('chat-container');

    function addMessage(text, sender) {
        const div = document.createElement('div');
        div.className = `message ${sender === 'user' ? 'user-message' : 'ai-message'}`;
        div.innerHTML = text; 
        chatContainer.appendChild(div);
        chatContainer.scrollTop = chatContainer.scrollHeight; 
    }

    async function sendMessage() {
        const text = userInput.value.trim();
        if (!text) return;

        addMessage(text, 'user');
        userInput.value = '';

        const loadingId = 'loading-' + Date.now();
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'message ai-message';
        loadingDiv.id = loadingId;
        loadingDiv.innerText = '...';
        chatContainer.appendChild(loadingDiv);

        try {
            // CORREÇÃO: Removido localhost
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });

            document.getElementById(loadingId).remove();

            if (!response.ok) {
                throw new Error(`Erro API: ${response.status}`);
            }

            const data = await response.json();
            addMessage(data.reply, 'ai');

        } catch (error) {
            const loadingEl = document.getElementById(loadingId);
            if(loadingEl) loadingEl.remove();

            if (error.message.includes('503')) {
                addMessage("⚠️ Os meus servidores estão com muito tráfego agora. Podes tentar daqui a 30 segundos?", 'ai');
            } else {
                addMessage("⚠️ Não consegui ligar ao servidor. Verifica a tua conexão.", 'ai');
            }
        }
    }

    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
});