// index.js - Backend corrigido
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// Configuração CORS mais permissiva
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://pohqjocjoeuirfwmvnqe.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvaHFqb2Nqb2V1aXJmd212bnFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMzUyODQsImV4cCI6MjA5NjgxMTI4NH0.S4h5cZ9PE3XVBc8tshQljphlsAVhu-2OEEdJNYgo7UY';
const supabase = createClient(supabaseUrl, supabaseKey);

// ==================== AUTENTICAÇÃO ====================   

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('📝 Tentativa de login:', req.body.email);
    
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('❌ Erro no login:', error.message);
      return res.status(401).json({ error: error.message });
    }

    // Busca o perfil do usuário
    const { data: perfil, error: perfilError } = await supabase
      .from('perfis')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (perfilError && perfilError.code !== 'PGRST116') {
      console.error('Erro ao buscar perfil:', perfilError);
    }

    console.log('✅ Login bem-sucedido:', email);
    
    res.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        ...perfil
      }
    });
  } catch (error) {
    console.error('❌ Erro no login:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Cadastro
app.post('/api/auth/cadastro', async (req, res) => {
  try {
    console.log('📝 Dados recebidos no cadastro:', req.body);
    
    const { email, password, nome_usuario } = req.body;

    // Validações detalhadas
    if (!email) {
      return res.status(400).json({ error: 'Email é obrigatório' });
    }
    
    if (!password) {
      return res.status(400).json({ error: 'Senha é obrigatória' });
    }
    
    if (!nome_usuario) {
      return res.status(400).json({ error: 'Nome de usuário é obrigatório' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' });
    }

    // Validação de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }

    // Verifica se o nome de usuário já existe
    const { data: usuarioExistente, error: buscaError } = await supabase
      .from('perfis')
      .select('nome_usuario')
      .eq('nome_usuario', nome_usuario)
      .maybeSingle();

    if (usuarioExistente) {
      return res.status(400).json({ error: 'Nome de usuário já está em uso' });
    }

    // Cria usuário no Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nome_usuario
        }
      }
    });

    if (error) {
      console.error('❌ Erro no cadastro (Auth):', error.message);
      return res.status(400).json({ error: error.message });
    }

    if (!data.user) {
      return res.status(400).json({ error: 'Erro ao criar usuário' });
    }

    // Cria perfil na tabela perfis
    const { error: perfilError } = await supabase
      .from('perfis')
      .insert([{
        id: data.user.id,
        nome_usuario,
        email,
        pontos: 0
      }]);

    if (perfilError) {
      console.error('❌ Erro ao criar perfil:', perfilError.message);
      // Tenta deletar o usuário criado no auth se falhar ao criar o perfil
      await supabase.auth.admin.deleteUser(data.user.id);
      return res.status(500).json({ error: 'Erro ao criar perfil do usuário' });
    }

    console.log('✅ Cadastro bem-sucedido:', email);
    
    res.json({
      success: true,
      message: 'Usuário cadastrado com sucesso',
      user: {
        id: data.user.id,
        email: data.user.email,
        nome_usuario
      }
    });
  } catch (error) {
    console.error('❌ Erro no cadastro:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// ==================== PERFIL ====================

app.post('/api/perfil', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'ID do usuário é obrigatório' });
    }

    const { data, error } = await supabase
      .from('perfis')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Perfil não encontrado' });
    }

    res.json(data);
  } catch (error) {
    console.error('❌ Erro ao buscar perfil:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// ==================== JOGOS ====================

app.get('/api/jogos', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('jogos')
      .select('*')
      .order('data_jogo', { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(data || []);
  } catch (error) {
    console.error('❌ Erro ao buscar jogos:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// ==================== PALPITES ====================

app.post('/api/palpites', async (req, res) => {
  try {
    const { userId, jogoId, placar_casa, placar_fora } = req.body;

    if (!userId || !jogoId || placar_casa === undefined || placar_fora === undefined) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    // Verifica se o jogo existe e não está encerrado
    const { data: jogo, error: jogoError } = await supabase
      .from('jogos')
      .select('encerrado')
      .eq('id', jogoId)
      .single();

    if (jogoError) {
      return res.status(404).json({ error: 'Jogo não encontrado' });
    }

    if (jogo.encerrado) {
      return res.status(400).json({ error: 'Este jogo já foi encerrado' });
    }

    // Verifica se já existe um palpite
    const { data: palpiteExistente } = await supabase
      .from('palpites')
      .select('id')
      .eq('usuario_id', userId)
      .eq('jogo_id', jogoId)
      .maybeSingle();

    let resultado;

    if (palpiteExistente) {
      // Atualiza
      const { data, error } = await supabase
        .from('palpites')
        .update({
          palpite_casa: placar_casa,
          palpite_fora: placar_fora,
          atualizado_em: new Date().toISOString()
        })
        .eq('id', palpiteExistente.id)
        .select();

      if (error) {
        return res.status(500).json({ error: error.message });
      }
      resultado = data;
    } else {
      // Cria novo
      const { data, error } = await supabase
        .from('palpites')
        .insert([{
          usuario_id: userId,
          jogo_id: jogoId,
          palpite_casa: placar_casa,
          palpite_fora: placar_fora,
          pontos_recebidos: 0,
          criado_em: new Date().toISOString()
        }])
        .select();

      if (error) {
        return res.status(500).json({ error: error.message });
      }
      resultado = data;
    }

    res.json({
      success: true,
      palpite: resultado[0]
    });
  } catch (error) {
    console.error('❌ Erro ao salvar palpite:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// ==================== RANKING ====================

app.get('/api/ranking', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('perfis')
      .select('id, nome_usuario, pontos')
      .order('pontos', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(data || []);
  } catch (error) {
    console.error('❌ Erro ao buscar ranking:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// ==================== ROTA DE SAÚDE ====================

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'online', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ==================== EXPORTAÇÃO ====================

module.exports = app;

// Para rodar localmente
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📊 Supabase URL: ${supabaseUrl}`);
  });
}