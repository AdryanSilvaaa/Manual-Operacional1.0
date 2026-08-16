# Manual Operacional Digital

## Visão geral

O Manual Operacional Digital é uma aplicação web para publicar, distribuir e acompanhar materiais operacionais em PDF e vídeo. O sistema organiza os manuais por sistema e setor, controla o acesso por perfil e registra o progresso individual de cada operador.

O objetivo é substituir a distribuição informal de procedimentos por uma biblioteca centralizada, pesquisável e auditável. Gerentes e suporte conseguem acompanhar quem iniciou, quem concluiu e quais materiais têm menor adesão.

## Público e perfis

- **Operador (`usuario`)**: acessa os sistemas e manuais do próprio setor, lê PDFs, assiste vídeos, responde questionários e acompanha seu progresso.
- **Gerente de setor (`gerente_setor`)**: publica manuais no próprio setor e consulta o painel restrito ao setor.
- **Suporte (`suporte`)**: administra usuários, setores, sistemas e manuais e consulta dados de todos os setores.
- **Gerente legado (`gerente`)**: ainda é aceito por alguns middlewares para compatibilidade, mas o `schema.sql` migra esse perfil para `suporte`.

## Recursos principais

- Login por identificador e senha com JWT de oito horas.
- Bloqueio temporário após cinco tentativas inválidas.
- Usuários vinculados a setores.
- Catálogo de sistemas e manuais com pesquisa por nome.
- Upload de PDF e vídeo, localmente ou no Supabase Storage.
- Leitor PDF com PDF.js, navegação paginada e retomada.
- Registro de páginas visitadas e percentual do vídeo assistido.
- Questionários opcionais com aprovação mínima de 70%.
- Prazos, situação de atraso e progresso nos cards.
- Painel por manual e operador, com filtros e exportação CSV.
- Versionamento ao substituir os arquivos de um manual.
- Histórico de progresso de versões anteriores.
- Troca de senha e trilha inicial de auditoria.
- Modo de demonstração em memória quando o PostgreSQL estiver indisponível.

## Regra de conclusão

O PDF e o vídeo possuem pesos iguais no percentual visual:

- PDF: até 50%, proporcional às páginas visitadas.
- Vídeo: até 50%, proporcional ao tempo efetivamente assistido.

O manual fica concluído quando:

1. todas as páginas do PDF foram visitadas;
2. pelo menos 90% do vídeo foi assistido;
3. quando houver questionário, existe uma tentativa aprovada com nota mínima de 70%.

## Arquitetura

```text
Navegador
  React 18 + React Router + PDF.js
             |
             | HTTP/JSON, multipart e JWT
             v
  Node.js + Express
    rotas -> controllers -> models
             |
             +--> PostgreSQL
             +--> Supabase Storage ou backend/uploads
```

### Frontend

- `frontend/src/AppRoutes.jsx`: mapa das telas e permissões de rota.
- `frontend/src/context/AuthContext.jsx`: sessão, token e usuário atual.
- `frontend/src/components/ManualViewer.jsx`: composição do treinamento.
- `frontend/src/components/PdfReader.jsx`: renderização e navegação do PDF.
- `frontend/src/pages/PainelUso.jsx`: indicadores e relatório.
- `frontend/src/pages/CriarManual.jsx`: criação de manuais e questionários.

### Backend

- `backend/src/app.js`: Express, CORS, rotas e erros.
- `backend/src/routes`: definição dos endpoints e middlewares.
- `backend/src/controllers`: validação HTTP e coordenação das operações.
- `backend/src/models`: SQL e persistência.
- `backend/src/config/storage.js`: armazenamento de arquivos.
- `backend/src/config/demoStore.js`: armazenamento temporário em memória.
- `backend/sql/schema.sql`: estrutura e migrações idempotentes.

## Fluxos principais

### Publicação

1. Suporte ou gerente abre **Configurações > Criar Manual**.
2. Informa sistema, setor, título, prazo e arquivos.
3. Pode adicionar perguntas e alternativas.
4. A API armazena os arquivos e cria o manual.
5. O material passa a aparecer para operadores do setor.

### Treinamento

1. O operador escolhe um sistema e abre um manual.
2. O sistema cria o registro de progresso no primeiro acesso.
3. Cada página do PDF e os trechos reproduzidos do vídeo são salvos.
4. O operador responde ao questionário, se existir.
5. Ao satisfazer todas as condições, `completed_at` é registrado.

### Acompanhamento

1. Suporte ou gerente abre o painel de uso.
2. A API cruza operadores e manuais do setor, inclusive itens não iniciados.
3. A interface calcula indicadores e gráficos.
4. Os dados filtrados podem ser exportados em CSV.

## Limitações atuais

- O bloqueio de login é mantido na memória do processo e deve migrar para Redis em múltiplas instâncias.
- A trilha de auditoria registra login e troca de senha; outras ações podem ser adicionadas.
- O modo demo perde os dados quando o backend é reiniciado.
- A tabela `permissions` existe, mas a autorização corrente é baseada principalmente no setor.
- Não existe recuperação de senha por e-mail nem serviço de notificações.

