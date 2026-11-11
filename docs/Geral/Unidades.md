# Unidades (filiais) no Prumo

Regra do produto (vale para qualquer cliente, não só para a Plena). Criado em 11/11/2026.

## A regra

- **Setor é comum à rede.** "Faturamento" é um setor só, em todas as unidades.
- **Unidade é um segundo filtro.** Cada usuário tem uma ou mais unidades (ex.: Adryan é da Matriz).
- **Manual** vale para um ou mais setores e para:
  - **Todas as unidades** (nenhuma unidade gravada), ou
  - **Unidades específicas** (uma ou mais).
- O colaborador vê o manual quando ele é **de um dos seus setores E** (de **todas as unidades** ou de **uma das suas unidades**).

Exemplo: o gerente de Faturamento atende Matriz e Unidade Sul. Ele publica um manual só para a Matriz
(só o Faturamento da Matriz vê) ou para todas as unidades (o Faturamento de toda a rede vê).

## Perfis

| Perfil | Unidades |
|---|---|
| Admin, Editor de conteúdo | Enxergam todas as unidades (`all_units`); não precisam de unidade. |
| Administrador de cadastros | Cadastra unidades e usuários de qualquer unidade. Como colaborador, lê os manuais da sua unidade. |
| Gerente de setor | Publica nos seus setores para as suas unidades ou para **todas as unidades**. Painel, resultados e colaboradores só das suas unidades. Edita manuais dos seus setores que sejam das suas unidades ou de todas. |
| Gestor de área | Painel e resultados dos seus setores, só nas suas unidades. |
| Usuário comum | Vê os manuais e provas do seu setor na sua unidade (ou de todas as unidades). |

Todos os perfis sem `all_units` precisam de pelo menos uma unidade. Se a empresa tiver **uma unidade só**, ela é usada
automaticamente (na tela, na API e na planilha) e os campos de unidade nem aparecem: quem não trabalha com filiais não percebe a funcionalidade.

## Provas

- **Prova do manual:** segue os setores e as unidades do manual.
- **Prova aplicada de um modelo para o setor:** pode valer para todas as unidades ou para uma unidade (`exams.unit_id`).
- **Prova para colaboradores escolhidos:** só eles recebem; o gerente só enxerga e escolhe colaboradores das suas unidades.

## Banco de dados

| Objeto | Função |
|---|---|
| `units (id, nome, cep, logradouro, numero, complemento, bairro, cidade, uf, created_at, updated_at)` | Unidades. Nome único sem diferenciar maiúsculas (`idx_units_nome_unique` em `LOWER(nome)`). Endereço opcional: `units_cep_check` (8 dígitos, sem traço) e `units_uf_check` (2 letras maiúsculas). |
| `user_units (user_id, unit_id)` | Unidades de cada usuário. `ON DELETE CASCADE` no usuário, `RESTRICT` na unidade. |
| `manual_units (manual_id, unit_id)` | Unidades do manual. **Sem linhas = todas as unidades.** `CASCADE` no manual, `RESTRICT` na unidade. |
| `exams.unit_id` | Unidade da prova avulsa (nulo = todas). Restrição `exams_manual_unit_check`: prova de manual não tem `unit_id`. |
| Índices | `idx_user_units_unit_id`, `idx_manual_units_unit_id`, `idx_exams_unit_id` (parcial). |

Uma unidade com usuários, manuais ou provas não pode ser excluída (a API responde 409); tire os vínculos antes ou renomeie.

### Migração (`npm run db:migrate`)

Na primeira execução depois desta versão, enquanto não existir nenhuma unidade:
1. cria a unidade **Matriz**;
2. coloca **todos os usuários atuais** na Matriz;
3. deixa **todos os manuais atuais** para todas as unidades (nenhuma linha em `manual_units`).

Ninguém perde acesso no dia da migração. Depois é só cadastrar as outras unidades e mover as pessoas.
O script é idempotente (pode rodar de novo). Observação: se algum dia todas as unidades forem excluídas, a próxima
migração recria a Matriz e coloca todos os usuários nela.

## API

| Método | Rota | Permissão |
|---|---|---|
| GET | `/api/units` | cadastrar usuários, cadastrar unidades, publicar ou ver painel |
| POST | `/api/units` `{ nome, cep, logradouro, numero, complemento, bairro, cidade, uf }` | `manage_units` |
| PUT | `/api/units/:id` (mesmos campos; substitui o endereço inteiro) | `manage_units` |
| DELETE | `/api/units/:id` | `manage_units` (409 se em uso) |

Endereço da unidade: só `nome` é obrigatório. O CEP aceita com ou sem traço e é gravado com os 8 números; UF precisa ser uma sigla válida.
Limites: logradouro 160, número 20, complemento 80, bairro 80, cidade 80. Na tela, o CEP completo busca logradouro, bairro, cidade e UF
na consulta pública do ViaCEP (`viacep.com.br`, direto do navegador) sem apagar o que já foi digitado; se a rede bloquear, digita-se à mão.

Campos novos:
- Usuário (`POST /api/auth/register`, `PUT /api/users/:id`): `unitIds` (lista). No PUT, sem `unitIds` as unidades atuais são mantidas. As respostas trazem `unit_ids` e `unidades`.
- Planilha de usuários: coluna opcional `unidades` (nomes separados por vírgula).
- Manual (`POST`/`PUT /api/manuals`): `unitScope` (`todas` ou `selecionadas`) e `unitIds`. No PUT, sem os dois as unidades não mudam. Respostas trazem `unit_ids` e `unit_names`.
- Aplicar modelo (`POST /api/exam-templates/:id/apply`): `unitId` opcional (nulo = todas as unidades).
- Painel (`GET /api/progress/report`): `unit_names` da pessoa. Resultados (`GET /api/exams/results`): `unit_id` e `unit_name`.

## Onde fica no código

- Regras: `backend/src/utils/access.js` (`seesAllUnits`, `roleNeedsUnit`, `hasUnit`, `reachesUserUnits`, `canPublishToUnits`, `canManageManual`).
- SQL compartilhado: `backend/src/utils/unitSql.js`.
- Cadastro: `models/Unit.js`, `controllers/unitController.js`, `routes/units.js`.
- Telas: `pages/Unidades.jsx`, `components/UnitScopePicker.jsx` e os campos em Usuários, Criar/Gerenciar Manuais, Modelos de Prova e Painel.
