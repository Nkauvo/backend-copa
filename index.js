// index.js - Backend para Bolão da Copa
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://seu-projeto.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sua-chave-anon';
const supabase = createClient(supabaseUrl, supabaseKey);

// ==================== AUTENTICAÇÃO ====================

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
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

    res.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        ...perfil
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Cadastro
app.post('/api/auth/cadastro', async (req, res) => {
  try {
    const { email, password, nome_usuario } = req.body;

    // Validações
    if (!email || !password || !nome_usuario) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' });
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
      return res.status(400).json({ error: error.message });
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
      console.error('Erro ao criar perfil:', perfilError);
      // Não retorna erro pois o usuário já foi criado
    }

    res.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        nome_usuario
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// ==================== PERFIL ====================

app.post('/api/perfil', async (req, res) => {
  try {
    const { userId } = req.body;

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
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// ==================== JOGOS ====================

// Listar todos os jogos
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
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Buscar jogo por ID
app.get('/api/jogos/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('jogos')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Jogo não encontrado' });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// ==================== PALPITES ====================

// Criar/Atualizar palpite
app.post('/api/palpites', async (req, res) => {
  try {
    const { userId, jogoId, placar_casa, placar_fora } = req.body;

    // Validações
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

    // Verifica se já existe um palpite para este jogo
    const { data: palpiteExistente, error: buscaError } = await supabase
      .from('palpites')
      .select('id')
      .eq('usuario_id', userId)
      .eq('jogo_id', jogoId)
      .single();

    let resultado;

    if (palpiteExistente) {
      // Atualiza palpite existente
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
      // Cria novo palpite
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
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Listar palpites de um usuário
app.get('/api/palpites/usuario/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

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
      return res.status(500).json({ error: error.message });
    }

    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Listar todos os palpites
app.get('/api/palpites', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('palpites')
      .select(`
        *,
        perfis (nome_usuario),
        jogos (
          time_casa,
          time_fora,
          data_jogo,
          gols_casa,
          gols_fora,
          encerrado
        )
      `)
      .order('criado_em', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(data || []);
  } catch (error) {
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
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// ==================== PONTUAÇÃO (Sistema de Pontos) ====================

// Calcular pontos após um jogo ser encerrado
app.post('/api/calcular-pontos', async (req, res) => {
  try {
    const { jogoId } = req.body;

    // Busca o jogo
    const { data: jogo, error: jogoError } = await supabase
      .from('jogos')
      .select('*')
      .eq('id', jogoId)
      .single();

    if (jogoError || !jogo) {
      return res.status(404).json({ error: 'Jogo não encontrado' });
    }

    if (!jogo.encerrado) {
      return res.status(400).json({ error: 'Jogo ainda não foi encerrado' });
    }

    // Busca todos os palpites para este jogo
    const { data: palpites, error: palpitesError } = await supabase
      .from('palpites')
      .select('*')
      .eq('jogo_id', jogoId);

    if (palpitesError) {
      return res.status(500).json({ error: palpitesError.message });
    }

    const golsCasa = jogo.gols_casa || 0;
    const golsFora = jogo.gols_fora || 0;

    let resultados = [];

    for (const palpite of palpites) {
      let pontos = 0;

      // Verifica se acertou o placar exato
      if (palpite.palpite_casa === golsCasa && palpite.palpite_fora === golsFora) {
        pontos = 5; // Placar exato
      } 
      // Verifica se acertou o vencedor ou empate
      else {
        const palpiteResultado = palpite.palpite_casa > palpite.palpite_fora ? 'casa' :
                                 palpite.palpite_casa < palpite.palpite_fora ? 'fora' : 'empate';
        const jogoResultado = golsCasa > golsFora ? 'casa' :
                             golsCasa < golsFora ? 'fora' : 'empate';

        if (palpiteResultado === jogoResultado) {
          pontos = 3; // Acertou o resultado
        }

        // Bônus por acertar o placar de um dos times
        if (palpite.palpite_casa === golsCasa || palpite.palpite_fora === golsFora) {
          pontos += 1;
        }
      }

      // Atualiza os pontos do palpite
      const { error: updateError } = await supabase
        .from('palpites')
        .update({ pontos_recebidos: pontos })
        .eq('id', palpite.id);

      if (updateError) {
        console.error('Erro ao atualizar pontos do palpite:', updateError);
      }

      // Atualiza os pontos do usuário
      const { data: usuario, error: usuarioError } = await supabase
        .from('perfis')
        .select('pontos')
        .eq('id', palpite.usuario_id)
        .single();

      if (!usuarioError && usuario) {
        const novosPontos = (usuario.pontos || 0) + pontos;
        await supabase
          .from('perfis')
          .update({ pontos: novosPontos })
          .eq('id', palpite.usuario_id);
      }

      resultados.push({
        usuario_id: palpite.usuario_id,
        pontos_recebidos: pontos,
        palpite: `${palpite.palpite_casa}x${palpite.palpite_fora}`,
        resultado: `${golsCasa}x${golsFora}`
      });
    }

    res.json({
      success: true,
      jogo: `${jogo.time_casa} vs ${jogo.time_fora}`,
      resultado: `${golsCasa}x${golsFora}`,
      palpites_processados: resultados
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// ==================== ROTA DE SAÚDE ====================

app.get('/api/health', (req, res) => {
  res.json({ status: 'online', timestamp: new Date().toISOString() });
});

// ==================== EXPORTAÇÃO PARA VERCEL ====================

module.exports = app;

// Para rodar localmente
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📊 Supabase URL: ${supabaseUrl}`);
  });
}