// index.js - Backend com logs detalhados
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// ================= CONFIGURAÇÕES =================
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ================= LOG DE REQUISIÇÕES =================
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path}`);
  console.log('📦 Body:', req.body);
  next();
});

// ================= SUPABASE =================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

console.log('🔍 Verificando variáveis de ambiente:');
console.log('SUPABASE_URL:', supabaseUrl ? '✅ Configurado' : '❌ NÃO CONFIGURADO');
console.log('SUPABASE_ANON_KEY:', supabaseKey ? '✅ Configurado' : '❌ NÃO CONFIGURADO');

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ ERRO CRÍTICO: Variáveis de ambiente não configuradas!');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ================= ROTA DE TESTE =================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    supabase_configured: !!supabaseUrl && !!supabaseKey,
    environment: process.env.NODE_ENV || 'development'
  });
});

// ================= CADASTRO COM LOGS DETALHADOS =================
app.post('/api/auth/cadastro', async (req, res) => {
  console.log('🔵 ===== INICIANDO CADASTRO =====');
  console.log('📝 Body recebido:', JSON.stringify(req.body, null, 2));
  
  try {
    const { email, password, nome_usuario } = req.body;

    // Validação 1: Campos obrigatórios
    console.log('🔍 Validando campos...');
    if (!email) {
      console.log('❌ Email faltando');
      return res.status(400).json({ error: 'Email é obrigatório' });
    }
    
    if (!password) {
      console.log('❌ Senha faltando');
      return res.status(400).json({ error: 'Senha é obrigatória' });
    }
    
    if (!nome_usuario) {
      console.log('❌ Nome de usuário faltando');
      return res.status(400).json({ error: 'Nome de usuário é obrigatório' });
    }

    console.log('✅ Campos validados:', { email, nome_usuario });

    // Validação 2: Tamanho da senha
    if (password.length < 6) {
      console.log('❌ Senha muito curta');
      return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' });
    }

    // Validação 3: Formato do email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('❌ Email inválido:', email);
      return res.status(400).json({ error: 'Email inválido' });
    }

    console.log('✅ Email válido');

    // Verifica se o nome de usuário já existe
    console.log('🔍 Verificando se usuário já existe...');
    const { data: usuarioExistente, error: buscaError } = await supabase
      .from('perfis')
      .select('nome_usuario')
      .eq('nome_usuario', nome_usuario)
      .maybeSingle();

    if (buscaError) {
      console.log('⚠️ Erro ao buscar usuário:', buscaError.message);
    }

    if (usuarioExistente) {
      console.log('❌ Nome de usuário já existe:', nome_usuario);
      return res.status(400).json({ error: 'Nome de usuário já está em uso' });
    }

    console.log('✅ Nome de usuário disponível');

    // Cria usuário no Auth
    console.log('🔐 Criando usuário no Supabase Auth...');
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
      console.error('❌ Erro no Auth:', error.message);
      console.error('❌ Detalhes completos:', JSON.stringify(error, null, 2));
      console.error('❌ Status:', error.status);
      console.error('❌ Code:', error.code);
      
      const errMsg = error.message || error.msg || '';
      
      if (errMsg.includes('already registered') || errMsg.includes('already been registered')) {
        return res.status(400).json({ error: 'Este email já está cadastrado' });
      }
      
      if (errMsg.includes('rate limit') || errMsg.includes('too many')) {
        return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' });
      }

      if (errMsg.includes('invalid') || errMsg.includes('Invalid')) {
        return res.status(400).json({ error: 'Dados inválidos. Verifique email e senha.' });
      }
      
      return res.status(400).json({ 
        error: errMsg || 'Erro ao criar conta. Verifique seus dados e tente novamente.',
        details: error.status || error.code || 'unknown'
      });
    }

    if (!data.user) {
      console.error('❌ Usuário não criado');
      return res.status(400).json({ error: 'Erro ao criar usuário' });
    }

    console.log('✅ Usuário criado no Auth:', data.user.id);

    // Cria perfil na tabela perfis
    console.log('📝 Criando perfil do usuário...');
    const { error: perfilError } = await supabase
      .from('perfis')
      .insert({
        id: data.user.id,
        nome_usuario,
        email,
        pontos: 0
      });

    if (perfilError) {
      console.error('❌ Erro ao criar perfil:', perfilError.message);
      console.error('❌ Detalhes:', perfilError);
      
      // Tenta deletar o usuário criado no auth
      try {
        await supabase.auth.admin.deleteUser(data.user.id);
        console.log('🗑️ Usuário deletado do Auth devido a erro no perfil');
      } catch (deleteError) {
        console.error('❌ Erro ao deletar usuário:', deleteError);
      }
      
      return res.status(500).json({ 
        error: 'Erro ao criar perfil do usuário',
        details: perfilError.message
      });
    }

    console.log('✅ Perfil criado com sucesso para:', email);
    console.log('🔵 ===== CADASTRO CONCLUÍDO COM SUCESSO =====');
    
    res.json({
      success: true,
      message: 'Usuário cadastrado com sucesso!',
      user: {
        id: data.user.id,
        email: data.user.email,
        nome_usuario
      }
    });
  } catch (error) {
    console.error('❌ Erro inesperado no cadastro:', error);
    console.error('❌ Stack:', error.stack);
    res.status(500).json({ 
      error: 'Erro interno no servidor',
      details: error.message 
    });
  }
});

// ================= ROTA DE TESTE DO SUPABASE =================
app.get('/api/test-supabase', async (req, res) => {
  try {
    console.log('🔍 Testando conexão com Supabase...');
    
    // Tenta fazer uma consulta simples
    const { data, error } = await supabase
      .from('perfis')
      .select('count')
      .limit(1);

    if (error) {
      console.error('❌ Erro no teste:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
        details: error
      });
    }

    res.json({
      success: true,
      message: 'Conexão com Supabase OK',
      supabase_url: supabaseUrl ? '✅ Configurado' : '❌ Não configurado',
      data: data
    });
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ================= OUTRAS ROTAS =================
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

    const { data: perfil, error: perfilError } = await supabase
      .from('perfis')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (perfilError && perfilError.code !== 'PGRST116') {
      console.error('Erro ao buscar perfil:', perfilError.message);
    }

    console.log('✅ Login bem-sucedido:', email);
    
    res.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        nome_usuario: perfil?.nome_usuario || data.user.user_metadata?.nome_usuario || 'Usuário',
        pontos: perfil?.pontos || 0
      }
    });
  } catch (error) {
    console.error('❌ Erro no login:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

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
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Perfil não encontrado' });
      }
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    console.error('❌ Erro ao buscar perfil:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

app.get('/api/jogos', async (req, res) => {
  try {
    console.log('📝 Buscando jogos...');
    
    const { data, error } = await supabase
      .from('jogos')
      .select('*')
      .order('data_jogo', { ascending: true });

    if (error) {
      console.error('❌ Erro ao buscar jogos:', error.message);
      return res.status(500).json({ error: error.message });
    }

    console.log(`✅ ${data?.length || 0} jogos encontrados`);
    res.json(data || []);
  } catch (error) {
    console.error('❌ Erro ao buscar jogos:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

app.post('/api/palpites', async (req, res) => {
  try {
    const { userId, jogoId, placar_casa, placar_fora } = req.body;

    console.log('📝 Salvando palpite:', { userId, jogoId, placar_casa, placar_fora });

    if (!userId || !jogoId || placar_casa === undefined || placar_fora === undefined) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

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

    const { data: palpiteExistente } = await supabase
      .from('palpites')
      .select('id')
      .eq('usuario_id', userId)
      .eq('jogo_id', jogoId)
      .maybeSingle();

    let resultado;

    if (palpiteExistente) {
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
        console.error('❌ Erro ao atualizar palpite:', error.message);
        return res.status(500).json({ error: error.message });
      }
      resultado = data;
    } else {
      const { data, error } = await supabase
        .from('palpites')
        .insert({
          usuario_id: userId,
          jogo_id: jogoId,
          palpite_casa: placar_casa,
          palpite_fora: placar_fora,
          pontos_recebidos: 0,
          criado_em: new Date().toISOString()
        })
        .select();

      if (error) {
        console.error('❌ Erro ao criar palpite:', error.message);
        return res.status(500).json({ error: error.message });
      }
      resultado = data;
    }

    console.log('✅ Palpite salvo com sucesso');
    res.json({
      success: true,
      palpite: resultado[0]
    });
  } catch (error) {
    console.error('❌ Erro ao salvar palpite:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

app.get('/api/palpites/usuario/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    console.log('📝 Buscando palpites do usuário:', userId);

    const { data, error } = await supabase
      .from('palpites')
      .select(`
        *,
        jogos (
          time_casa,
          time_fora,
          escudo_casa,
          escudo_fora,
          data_jogo,
          gols_casa,
          gols_fora,
          encerrado
        )
      `)
      .eq('usuario_id', userId)
      .order('criado_em', { ascending: false });

    if (error) {
      console.error('❌ Erro ao buscar palpites:', error.message);
      return res.status(500).json({ error: error.message });
    }

    console.log(`✅ ${data?.length || 0} palpites encontrados`);
    res.json(data || []);
  } catch (error) {
    console.error('❌ Erro ao buscar palpites:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

app.get('/api/ranking', async (req, res) => {
  try {
    console.log('📝 Buscando ranking...');

    const { data, error } = await supabase
      .from('perfis')
      .select('id, nome_usuario, pontos')
      .order('pontos', { ascending: false });

    if (error) {
      console.error('❌ Erro ao buscar ranking:', error.message);
      return res.status(500).json({ error: error.message });
    }

    console.log(`✅ ${data?.length || 0} usuários no ranking`);
    res.json(data || []);
  } catch (error) {
    console.error('❌ Erro ao buscar ranking:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});


// ================= ERROR HANDLER GLOBAL =================
app.use((err, req, res, next) => {
  console.error('❌ Erro não tratado:', err.message);
  console.error('❌ Stack:', err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Erro interno no servidor',
    details: err.type || 'unhandled_error'
  });
});

// ================= EXPORTAÇÃO =================
module.exports = app;

// Para rodar localmente
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📊 Supabase URL: ${supabaseUrl ? '✅ Configurado' : '❌ Não configurado'}`);
    console.log(`🔑 Supabase Key: ${supabaseKey ? '✅ Configurado' : '❌ Não configurado'}`);
  });
}