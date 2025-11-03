import express from 'express';
import Groq from 'groq-sdk';
import cors from 'cors';
import 'dotenv/config'; // Carrega a chave do ambiente

const app = express();
app.use(cors()); // Permite que seu frontend chame este backend
app.use(express.json());

// Pega a chave secreta do Render
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

if (!process.env.GROQ_API_KEY) {
    console.error("ERRO: A variável GROQ_API_KEY não foi definida no Render.");
}

// Endpoint para o Chat do Aluno
app.post('/api/chat', async (req, res) => {
    try {
        const { history } = req.body;
        if (!history) {
            return res.status(400).json({ error: 'Nenhum histórico fornecido.' });
        }

        const completion = await groq.chat.completions.create({
            messages: history,
            model: "llama3-8b-8192"
        });

        res.json({ response: completion.choices[0].message.content });

    } catch (error) {
        console.error('Erro no /api/chat:', error);
        res.status(500).json({ error: 'Falha ao processar a resposta do chat.' });
    }
});

// Endpoint para o Diagnóstico do Lead
app.post('/api/diagnose', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'Nenhum prompt fornecido.' });
        }
        
        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: "Você é um especialista em CEFR e diagnóstico de inglês." },
                { role: "user", content: prompt }
            ],
            model: "llama3-8b-8192"
        });

        res.json({ response: completion.choices[0].message.content });

    } catch (error) {
        console.error('Erro no /api/diagnose:', error);
        res.status(500).json({ error: 'Falha ao processar o diagnóstico.' });
    }
});


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor seguro do Sr. Mastrius rodando na porta ${PORT}`);
});
