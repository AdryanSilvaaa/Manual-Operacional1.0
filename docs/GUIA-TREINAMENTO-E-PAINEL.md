# Guia de treinamento, acompanhamento e segurança

## Instalação da atualização

Execute novamente `backend/sql/schema.sql` no PostgreSQL. O script é idempotente e preserva usuários, sistemas, manuais e progressos existentes.

```powershell
psql "$env:DATABASE_URL" -f backend/sql/schema.sql
```

Depois instale as dependências e reinicie os serviços:

```powershell
cd frontend
npm install
npm run build
```

## Progresso do operador

O leitor usa PDF.js e exibe uma página por vez. A cada página aberta, a API salva o número da página, o total do documento, a última página e o conjunto de páginas já vistas. Ao retornar, o leitor reabre na última página alcançada. O PDF só fica concluído depois que todas as páginas forem visitadas.

O vídeo soma apenas intervalos reproduzidos normalmente. Saltos feitos pela barra do player não acrescentam o trecho pulado. A parte de vídeo é concluída com 90% assistido.

Sem questionário, o manual é concluído quando o PDF está completo e o vídeo alcança 90%. Quando existem perguntas, também é necessário obter no mínimo 70% de acertos.

## Criação de manual e questionário

Em **Configurações > Criar Manual**, informe sistema, setor, título, descrição, prazo opcional, PDF e vídeo. Em **Questionário**, adicione perguntas, preencha quatro alternativas e escolha a correta. Perguntas são opcionais.

O prazo aparece no card. Um item não concluído depois da data é identificado como atrasado. Ao substituir PDF ou vídeo pela API administrativa, a versão do manual é incrementada.

## Painel de uso

O suporte visualiza todos os setores; o gerente de setor recebe apenas dados do próprio setor. É possível pesquisar por manual e operador, filtrar por setor e exportar a visão filtrada em CSV, compatível com Excel.

Os indicadores mostram operadores, leituras iniciadas, conclusões e taxa de conclusão. A tabela detalha PDF, vídeo, último acesso, conclusão, prazo, versão e páginas lidas fornecidos pela API.

## Segurança e auditoria

Após cinco senhas incorretas para a mesma combinação de IP e usuário, o login fica bloqueado por 15 minutos. A sessão JWT expira em oito horas. A opção **Alterar senha** fica no menu do perfil e exige pelo menos oito caracteres, uma letra e um número.

A tabela `audit_logs` registra login e troca de senha e está preparada para receber outras ações administrativas. A exclusão da própria conta administrativa permanece bloqueada.

## Testes e validação

```powershell
cd backend
npm test
node --check src/app.js

cd ../frontend
npm run build
```

Os testes automatizados cobrem política de senha e nota mínima do questionário. O build valida a integração React/PDF.js.

## Limitações conhecidas

- Visitar uma página comprova que ela foi exibida, não que seu conteúdo foi compreendido; o questionário é a confirmação pedagógica adicional.
- O bloqueio de login é mantido em memória. Em uma implantação com várias instâncias, use Redis ou outro armazenamento compartilhado.
- O CSV é o formato de exportação desta versão; PDF gerencial pode ser acrescentado posteriormente.
