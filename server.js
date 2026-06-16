const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// Configuração do CORS para aceitar requisições de qualquer origem (essencial para a Vercel)
app.use(cors());
app.use(express.json());

// Validação das variáveis de ambiente do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ ERRO: SUPABASE_URL ou SUPABASE_KEY não foram configuradas na Vercel!");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 1. Rota Inicial (Para você testar direto no navegador se o servidor está vivo)
app.get('/', (req, res) => {
    return res.json({ 
        status: "Online", 
        message: "Servidor do Bolão da Copa voando! 🚀⚽" 
    });
});

// 2. Rota de Cadastro (Modificada para quebrar o mistério do {"error":"{}"})
app.post('/auth/cadastro', async (req, res) => {
    const { email, password, nome_usuario } = req.body;

    if (!email || !password || !nome_usuario) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }

    try {
        // Criar o usuário no Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password
        });

        // Se o Supabase rejeitar, pegamos a propriedade .message explicitamente
        if (authError) {
            console.error("Erro no Supabase Auth:", authError.message);
            return res.status(400).json({ error: authError.message });
        }

        // Se o usuário foi criado, insere o perfil complementar na tabela 'perfis'
        if (authData?.user) {
            const { error: profileError } = await supabase
                .from('perfis')
                .insert([
                    { 
                        id: authData.user.id, 
                        nome_usuario: nome_usuario, 
                        pontos: 0 
                    }
                ]);

            if (profileError) {
                console.error("Erro na tabela perfis:", profileError.message);
                return res.status(400).json({ error: `Usuário criado, mas erro no perfil: ${profileError.message}` });
            }
        }

        return res.status(201).json({ message: 'Usuário criado com sucesso!' });

    } catch (err) {
        console.error("Erro interno no servidor:", err);
        return res.status(500).json({ error: err.message || 'Erro interno no servidor.' });
    }
});

// 3. Rota de Login
app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }

    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) return res.status(400).json({ error: error.message });

        return res.json({ user: data.user, session: data.session });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 4. Rota para buscar Perfil do usuário
app.post('/perfil', async (req, res) => {
    const { userId } = req.body;
    try {
        const { data, error } = await supabase
            .from('perfis')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) return res.status(400).json({ error: error.message });
        return res.json(data);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 5. Rota para buscar Jogos cadastrados
app.get('/jogos', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('jogos')
            .select('*')
            .order('data_jogo', { ascending: true });

        if (error) return res.status(400).json({ error: error.message });
        return res.json(data);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 6. Rota para salvar Palpites
app.post('/palpites', async (req, res) => {
    const { userId, jogoId, placar_casa, placar_fora } = req.body;
    try {
        const { data, error } = await supabase
            .from('palpites')
            .upsert([
                { 
                    user_id: userId, 
                    jogo_id: jogoId, 
                    placar_casa: parseInt(placar_casa), 
                    placar_fora: parseInt(placar_fora) 
                }
            ], { onConflict: 'user_id, jogo_id' });

        if (error) return res.status(400).json({ error: error.message });
        return res.json({ message: 'Palpite salvo com sucesso!', data });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 7. Rota para buscar Ranking Geral
app.get('/ranking', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('perfis')
            .select('nome_usuario, pontos')
            .order('pontos', { ascending: false });

        if (error) return res.status(400).json({ error: error.message });
        return res.json(data);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Inicialização do servidor local (caso use para testes)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});

module.exports = app;