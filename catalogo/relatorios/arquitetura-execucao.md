# Arquitetura: assistente que consulta a API do cliente

Decisão de 2026-09-17. O assistente de chat identifica o que o cliente quer, encontra o endpoint no catálogo, pede aprovação, **executa a consulta com a credencial do cliente** e devolve a planilha preenchida.

## Fluxo

1. **Pergunta.** "Quero as cobranças pagas de agosto."
2. **Busca no catálogo.** Recuperação sobre `chunks.jsonl` + filtro por sistema e por `execucao.seguro_para_executar`.
3. **Proposta.** O assistente mostra: sistema, endpoint, o que será consultado, filtros e as colunas da planilha.
4. **Aprovação do cliente.**
5. **Execução.** O backend busca a credencial no cofre, monta a chamada a partir de `execucao_auth`, pagina conforme `execucao.paginacao` e junta os registros.
6. **Planilha.** Colunas vindas de `execucao.colunas_sugeridas`, mais uma aba "Informações" com endpoint, filtros, quantidade de registros, data e link da documentação.

## Regras de segurança

- **Somente leitura.** O executor recusa qualquer endpoint cuja ação não seja de leitura. Sobre escrita, o assistente explica e entrega código; quem executa é o cliente.
- **Credenciais no cofre do backend**, cadastradas pelo cliente em tela própria. Nunca no texto do chat, no prompt, em log ou em planilha.
- **Aprovação explícita** antes de cada execução.
- **Limite de volume** por execução (`--max`), pausa entre páginas e respeito a `Retry-After` no HTTP 429.
- **Rastreabilidade:** a aba "Informações" registra o que foi consultado.

## O que o catálogo precisa fornecer (já especificado)

| Bloco | Onde | Para quê |
|---|---|---|
| `execucao_auth` | `system.json`, seção 6.1 | Como autenticar, quais credenciais o cliente cadastra e as base URLs por ambiente |
| `execucao` | cada endpoint, seção 7.1 | Se é executável, onde está a lista no JSON, como paginar, filtros e colunas |

O validador recusa: endpoint sem `execucao`, sistema documentado sem `execucao_auth`, e `seguro_para_executar` divergindo da ação canônica.

## Protótipo nesta máquina

`scripts/executar.py` implementa os passos 2, 3 e 5–6:

```bash
.venv\Scripts\python scripts\executar.py buscar "cobranças pagas em agosto" --sistema asaas
.venv\Scripts\python scripts\executar.py detalhar asaas.cobranca.listar
.venv\Scripts\python scripts\executar.py puxar asaas.cobranca.listar --filtro status=RECEIVED --ambiente sandbox
```

Autenticações suportadas: chave em header, Bearer, Basic (inclusive com a credencial no lugar do usuário, como na Focus NFe), OAuth2 client credentials, OAuth2 refresh token e mTLS com OAuth2. Paginação: offset, page, cursor, por versão (Focus NFe) e sem paginação. Lê também leitura via POST (`--corpo`) e array na raiz da resposta.

**Testado em 2026-09-17** contra um servidor local que imita uma API paginada:
- busca encontrou o endpoint a partir de uma pergunta em português;
- 23 registros lidos em 3 páginas, respeitando o fim da paginação;
- planilha gerada com cabeçalho fixo, filtro automático e aba de informações;
- endpoint de escrita **recusado**;
- credencial inválida: erro claro e nenhuma planilha criada;
- paginação por versão com array na raiz e Basic no formato da Focus NFe: 25 registros em 3 páginas;
- proteções: no máximo 500 páginas por consulta e parada na primeira página quando o tipo de paginação não é suportado.

Credenciais do protótipo ficam em `credenciais/<slug>.json` ou em variáveis de ambiente. A pasta está no `.gitignore`.

## O que falta para virar produto

1. **Cofre de credenciais** com criptografia, isolamento por cliente e rotação. O arquivo local é só protótipo.
2. **Camada de conversa:** transformar a busca por palavras em recuperação semântica sobre os chunks, com desambiguação ("qual desses três?").
3. **Autenticação do cliente e permissões** (quem pode consultar o quê).
4. **Execução assíncrona** para consultas longas, com fila e limite por cliente.
5. **OAuth completo:** telas de autorização e guarda do refresh token por cliente (caso Bling).
6. **Auditoria:** registro de quem consultou o quê e quando, sem gravar dado sensível.
7. **Cobertura do catálogo:** hoje 3 sistemas documentados; os blocos de execução estão sendo preenchidos.
