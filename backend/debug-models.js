    // Substitui pela tua chave API real
const API_KEY = "AIzaSyCfRU64BtPjnSh6CVDyN4jKFEBmEz5aUeQ";

const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

console.log("A perguntar à Google que modelos tens disponíveis...");

fetch(url)
  .then(res => res.json())
  .then(data => {
    if (data.error) {
        console.error("\n❌ ERRO DA CONTA:");
        console.error(data.error.message);
        console.log("\nSOLUÇÃO: Isto geralmente significa que tens de ir ao https://aistudio.google.com/");
        console.log("e aceitar os termos ou criar um projeto novo.");
    } else if (data.models) {
        console.log("\n✅ SUCESSO! A tua chave tem acesso a estes modelos:");
        data.models.forEach(m => {
            // Mostra apenas os modelos "generateContent" que nos interessam
            if(m.supportedGenerationMethods.includes("generateContent")) {
                console.log(` -> ${m.name}`);
            }
        });
        console.log("\n(Copia um destes nomes para o teu server.js)");
    } else {
        console.log("\n⚠️ A chave funciona, mas a lista de modelos veio vazia.");
    }
  })
  .catch(err => console.error("Erro de ligação:", err.message));