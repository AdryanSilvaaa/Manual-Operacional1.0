# Documentação do Manual Operacional Digital

Este diretório reúne a documentação funcional e técnica do projeto.

| Documento | Conteúdo |
|---|---|
| [PROJETO.md](PROJETO.md) | O que é o produto, público, recursos, arquitetura e fluxos principais |
| [INSTALACAO-E-OPERACAO.md](INSTALACAO-E-OPERACAO.md) | Instalação local, variáveis, banco, execução, testes e produção |
| [API.md](API.md) | Referência HTTP detalhada com autenticação, permissões e exemplos |
| [openapi.yaml](openapi.yaml) | Especificação OpenAPI 3.0 importável em Swagger, Postman e Insomnia |
| [BANCO-DE-DADOS.md](BANCO-DE-DADOS.md) | Tabelas, relacionamentos, exclusões e versionamento |
| [TABELAS-DO-BANCO.md](TABELAS-DO-BANCO.md) | Dicionário completo das tabelas, colunas, chaves, índices e regras |
| [GUIA-TREINAMENTO-E-PAINEL.md](GUIA-TREINAMENTO-E-PAINEL.md) | Regras de progresso, questionários, painel e segurança |
| [APIs por domínio](apis/README.md) | Um arquivo independente para cada conjunto de endpoints |

## Leitura recomendada

1. Comece por `PROJETO.md` para entender o sistema.
2. Use `INSTALACAO-E-OPERACAO.md` para preparar um ambiente.
3. Consulte `API.md` durante integrações.
4. Use `openapi.yaml` para explorar e testar os endpoints visualmente.

## Referência modular das APIs

- [Saúde do serviço](apis/HEALTH.md)
- [Autenticação e sessão](apis/AUTH.md)
- [Usuários](apis/USERS.md)
- [Setores](apis/SECTORS.md)
- [Sistemas](apis/SYSTEMS.md)
- [Manuais e uploads](apis/MANUALS.md)
- [Progresso e painel](apis/PROGRESS.md)
- [Questionários](apis/QUIZ.md)
