const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Inicializa o cliente do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ================= ROTAS DE AUTENTICAÇÃO =================

// 1. Cadastro de Usuário
app.post('/auth/cadastro', async (req, res) => {
    const { email, password, nome_usuario } = req.body;

    if (!email || !password || !nome_usuario) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }

    try {
        // Cria o usuário no Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password
        });

        // Se der erro no Auth, pegamos estritamente a propriedade .message como texto
        if (authError) {
            console.error("Erro detalhado do Supabase Auth:", authError);
            return res.status(400).json({ error: authError.message || 'Erro desconhecido no Auth' });
        }

        if (authData?.user) {
            // Cria o registro complementar na tabela 'perfis'
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
                console.error("Erro detalhado da tabela perfis:", profileError);
                return res.status(400).json({ error: profileError.message || 'Erro ao criar perfil' });
            }
        }

        return res.status(201).json({ message: 'Usuário e perfil criados com sucesso!' });

    } catch (err) {
        console.error("Erro interno capturado pelo catch:", err);
        return res.status(500).json({ error: err.message || 'Erro interno no servidor.' });
    }
});

// 2. Login de Usuário
app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) return res.status(400).json({ error: error.message });

        // Retorna os dados do usuário para o Front-end salvar no estado da aplicação
        return res.json({ user: data.user });

    } catch (err) {
        return res.status(500).json({ error: 'Erro interno no servidor.' });
    }
});


// ================= ROTAS DO DASHBOARD =================

// 3. Buscar Perfil do Usuário (Nome e Pontos)
app.post('/perfil', async (req, res) => {
    const { userId } = req.body;

    if (!userId) return res.status(400).json({ error: 'ID do usuário não fornecido.' });

    try {
        const { data, error } = await supabase
            .from('perfis')
            .select('nome_usuario, pontos')
            .eq('id', userId)
            .single();

        if (error) return res.status(400).json({ error: error.message });

        return res.json(data);
    } catch (err) {
        return res.status(500).json({ error: 'Erro interno ao buscar perfil.' });
    }
});

// 4. Listar Todos os Jogos
app.get('/jogos', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('jogos')
            .select('*')
            .order('data_jogo', { ascending: true });

        if (error) return res.status(400).json({ error: error.message });

        return res.json(data);
    } catch (err) {
        return res.status(500).json({ error: 'Erro interno ao buscar jogos.' });
    }
});

// 5. Salvar/Enviar um Palpite
app.post('/palpites', async (req, res) => {
    const { userId, jogoId, placar_casa, placar_fora } = req.body;

    if (!userId || !jogoId || placar_casa === undefined || placar_fora === undefined) {
        return res.status(400).json({ error: 'Dados do palpite incompletos.' });
    }

    try {
        // Validação opcional: Verificar se o jogo já encerrou antes de aceitar o palpite
        const { data: jogo } = await supabase
            .from('jogos')
            .select('encerrado')
            .eq('id', jogoId)
            .single();

        if (jogo && jogo.encerrado) {
            return res.status(400).json({ error: 'Este jogo já foi encerrado. Não são permitidos novos palpites.' });
        }

        // Insere o palpite na tabela 'palpites'
        // Nota: Se quiser permitir que o usuário atualize o palpite, use .upsert() configurando as chaves corretas.
        const { data, error } = await supabase
            .from('palpites')
            .insert([
                {
                    usuario_id: userId,
                    jogo_id: jogoId,
                    palpite_casa: parseInt(placar_casa),
                    palpite_fora: parseInt(placar_fora),
                    pontos_recebidos: 0 // Inicia com 0 até o jogo ser computado
                }
            ]);

        if (error) return res.status(400).json({ error: error.message });

        return res.json({ message: 'Palpite salvo com sucesso!' });
    } catch (err) {
        return res.status(500).json({ error: 'Erro interno ao salvar palpite.' });
    }
});

// 6. Buscar Ranking Geral de Usuários
app.get('/ranking', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('perfis')
            .select('nome_usuario, pontos')
            .order('pontos', { ascending: false }); // Maior pontuação primeiro

        if (error) return res.status(400).json({ error: error.message });

        return res.json(data);
    } catch (err) {
        return res.status(500).json({ error: 'Erro interno ao carregar o ranking.' });
    }
});

// Inicialização do Servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando redondinho na porta ${PORT}`);
});