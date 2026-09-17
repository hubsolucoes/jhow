# Kit de integração — Bling (API v3)

Kit pronto para ler dados do Bling em **Excel / Power BI** e integrar via **Python** ou **Node (TypeScript)**.
Você só preenche credenciais e ambiente; nenhum outro arquivo precisa ser editado.

> Conferido com a documentação oficial (developer.bling.com.br) em 17/09/2026.
> O refresh das consultas **não foi testado contra a API real** (não havia credencial de teste disponível); a estrutura do Power Query segue o protótipo validado no Excel 365.

## O que vem no kit

| Pasta / arquivo | Para quê |
|---|---|
| `powerquery/00_Parametros.pq` | Lê a tabela `tbConfig` (aba **Config**) no Excel. Único lugar com credencial no Excel. |
| `powerquery/00_Parametros_PowerBI.pq` | Mesmo papel no Power BI (valores fixos ou parâmetros do Power BI). |
| `powerquery/01_fnApi.pq` | Função `fnApi`: URL, token Bearer, paginação (`pagina`/`limite`), pausa de 0,4 s entre páginas e mensagens de erro legíveis. Só faz GET. |
| `powerquery/10_Pedidos.pq` … `18_CategoriasFinanceiras.pq` | Consultas prontas (só leitura): Pedidos, Produtos, Estoque, ContasReceber, ContasPagar, NotasFiscais, Contatos, PedidosCompra, CategoriasFinanceiras. |
| `powerquery/tbConfig.json` e `Config_layout.md` | Conteúdo e explicação da tabela `tbConfig`. |
| `python/cliente.py` + `.env.example` | Cliente completo: autorização OAuth, renovação de token, retry, paginação, leituras e escritas (pedido, contato, NF-e, baixa de título, estoque) e gravação do token na planilha. |
| `typescript/cliente.ts` + `.env.example` | O mesmo cliente para Node 18+ (sem dependências). |

## Antes de começar: como a autenticação do Bling funciona

O Bling **não tem chave de API**. Todo acesso usa **OAuth 2.0 (authorization code)**:

1. Você cadastra um **aplicativo** no Bling e recebe `Client ID` e `Client Secret`.
2. Um usuário da conta Bling **autoriza** o aplicativo no navegador. O Bling devolve um `code` que vale **1 minuto** e só pode ser usado **uma vez**.
3. O script troca o `code` por um **access_token** (usado nas chamadas; expira em poucas horas — o exemplo oficial mostra 6 h) e um **refresh_token** (vale **30 dias**, serve para pedir novos access_tokens sem nova autorização).

Os scripts Python/Node fazem os passos 2 e 3 e renovam o token sozinhos. O Power Query **não** consegue renovar (veja a seção Power BI/Excel).

## Passo 1 — Cadastrar o aplicativo no Bling

1. Entre na conta Bling com um usuário que tenha a permissão **Cadastro de aplicativos** (Preferências > Sistema > Usuários).
2. Abra **Central de Extensões > Área do Integrador > Criar aplicativo**.
3. Visibilidade: **Privado** (uso da própria empresa; não passa por homologação).
4. **Link de redirecionamento**: uma URL sua que receberá o retorno. Para uso interno pode ser uma página simples do seu site; o script só precisa que você copie a URL completa que aparece no navegador depois de autorizar (ela contém `?code=...&state=...`).
5. **Escopos**: marque só o necessário para as consultas/rotinas que você vai usar — pedidos de venda e de compra, produtos, estoques/depósitos, contatos, notas fiscais, contas a pagar/receber, categorias financeiras, formas de pagamento. Mudar escopos depois **revoga os tokens** de todos os usuários.
6. Salve e copie **Client ID** e **Client Secret** (aba Informações do app).

## Passo 2 — Configurar e obter o primeiro token (Python)

```bash
cd kit/python
pip install requests          # e, no Windows, se quiser gravar o token na planilha: pip install pywin32
cp .env.example .env          # no Windows: copy .env.example .env
```

Edite o `.env`:

```
BLING_AMBIENTE=sandbox
BLING_CLIENT_ID=<<SEU_CLIENT_ID>>
BLING_CLIENT_SECRET=<<SEU_CLIENT_SECRET>>
BLING_TOKENS_ARQUIVO=bling_tokens_sandbox.json
```

Depois rode:

```bash
python cliente.py autorizar
```

O script mostra um link. Abra, entre na conta Bling e clique em **Autorizar**. O navegador vai para o seu link de redirecionamento com `?code=...&state=...`: copie a URL inteira e cole no terminal **em até 1 minuto**. Os tokens ficam em `bling_tokens_sandbox.json` (proteja esse arquivo).

Teste com `python cliente.py exemplo` (mostra a empresa, pedidos do mês, produtos e saldos).

Node: `cd kit/typescript`, crie o `.env` a partir do `.env.example` e rode `npx tsx cliente.ts autorizar` (ou, no Node 23.6+, `node cliente.ts autorizar`). Não reaproveite o mesmo arquivo de tokens entre Python e Node ao mesmo tempo: cada renovação troca o refresh_token.

## Passo 3 — Excel

1. Gere a planilha (quem mantém o kit): `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\gerar_planilha.ps1 -Kit sistemas\bling\kit -Saida saida\Bling.xlsx`.
2. Na aba **Config** (tabela `tbConfig`), preencha `Ambiente`, `DataInicial` e `DataFinal` (AAAA-MM-DD, no máximo 1 ano de intervalo).
3. Grave o token na planilha **com ela fechada**:
   ```bash
   python cliente.py renovar --excel "C:\caminho\Bling.xlsx"
   ```
   (sem pywin32, rode `python cliente.py token` e cole o resultado no `AccessToken`).
4. Abra a planilha e use **Dados > Atualizar Tudo**. Se o Excel perguntar como acessar o conteúdo web, escolha **Anônimo**: o token vai pela aba Config.
5. Cada aba (Pedidos, Produtos, Estoque, ContasReceber, ContasPagar, NotasFiscais, Contatos, PedidosCompra, CategoriasFinanceiras) vira uma tabela para gráficos e tabelas dinâmicas.

**Token expirou?** Com token inválido o Excel não repassa o código HTTP; o kit mostra *"Credencial recusada (HTTP 401/403)"* (em algumas versões o Excel exibe "As credenciais fornecidas para a fonte Web são inválidas"). Rode de novo `python cliente.py renovar --excel ...` com a planilha fechada. Para não precisar lembrar, agende:

```
schtasks /Create /SC HOURLY /TN "Bling token" /TR "python C:\kit\python\cliente.py renovar --excel C:\planilhas\Bling.xlsx"
```

O agendamento só consegue gravar se a planilha estiver fechada naquele momento.

## Power BI

- No Power BI Desktop, crie consultas em branco com os nomes `Parametros` (conteúdo de `00_Parametros_PowerBI.pq`), `fnApi` e as consultas `1x_...` (o nome é o do arquivo sem o prefixo numérico). Prefira trocar os valores de `Parametros` por **parâmetros do Power BI**.
- **Limitação real:** o Power Query não guarda o novo refresh_token que o Bling devolve a cada renovação e chamar `/oauth/token` a cada atualização pode invalidar o token anterior (a documentação não garante que ele continue válido) e bloquear o IP (20 chamadas em 60 s = 60 min de bloqueio). Por isso o kit **não** renova token dentro do Power Query.
- **Alternativas viáveis:**
  1. *Desktop / atualização manual:* gere um token com `python cliente.py token`, cole no parâmetro e atualize.
  2. *Atualização agendada no serviço:* rode `cliente.py` agendado (servidor, Azure Function, VM) para extrair os dados e gravar num banco, SharePoint ou CSV, e conecte o Power BI a esse destino. É o caminho mais estável.
  3. Conector personalizado (Power Query SDK) com OAuth + gateway: possível em tese, não faz parte deste kit.

## Sandbox x produção

O Bling **não tem ambiente sandbox**: `sandbox` e `producao` usam a mesma URL (`https://api.bling.com.br/Api/v3`). No kit, `sandbox` significa **usar o token de uma conta Bling de teste** (o Bling dá 30 dias grátis). Para ir a produção:

1. Autorize o aplicativo na conta real e guarde os tokens num arquivo próprio (`BLING_TOKENS_ARQUIVO=bling_tokens_producao.json`).
2. Troque `BLING_AMBIENTE=producao` no `.env` e `Ambiente = producao` na aba Config.

**Risco:** em produção, criar pedidos, lançar estoque, baixar títulos e principalmente **enviar NF-e à SEFAZ** têm efeito real e fiscal. Os clientes pedem confirmação no terminal antes de gravar em produção (desative com `BLING_CONFIRMAR=0` só em rotinas automáticas revisadas). As consultas do Power Query só leem.

## Limites que o kit respeita

- 3 requisições por segundo e 120.000 por dia **por conta Bling** (todas as integrações somadas). O kit espera ~0,35–0,4 s entre chamadas e faz backoff em HTTP 429.
- Bloqueio de IP: 300 erros ou 600 requisições em 10 s (10 min); 20 chamadas a `/oauth/token` em 60 s (60 min).
- Filtros de data com mais de 1 ano retornam erro 400.
- A API não tem idempotência: os clientes procuram pedido por `numeroLoja` e contato por documento antes de criar. Não reenvie escritas às cegas.
- Não há endpoint para cancelar NF-e/NFC-e na API v3 (só NFS-e): faça no painel.

## Segurança

- **Não compartilhe a planilha** com a aba Config preenchida: o `AccessToken` dá acesso à conta Bling enquanto for válido.
- `Client Secret` e `refresh_token` ficam **só** no `.env` / arquivo de tokens do servidor — nunca na planilha. Em produção, use um cofre de segredos.
- Use um aplicativo com o **menor conjunto de escopos** possível e um usuário Bling com permissões restritas.
- Se algo vazar: em **Informações do app**, use *Redefinir client secret* e *Revogar usuários*; ou rode a revogação pelo cliente (`BlingCliente.revogar("logout")`).
- Adicione `.env` e `bling_tokens_*.json` ao `.gitignore`.

## Referências

- Aplicativos e OAuth: https://developer.bling.com.br/aplicativos
- Referência da API: https://developer.bling.com.br/referencia
- Limites: https://developer.bling.com.br/limites · Erros: https://developer.bling.com.br/erros-comuns
- JWT (`enable-jwt: 1`): https://developer.bling.com.br/migracao-jwt
