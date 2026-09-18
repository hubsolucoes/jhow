# JHOW — Assistente Sagi (SyGeCom)

Chat em que o cliente pede, em português, a informação que precisa do **Sagi (SyGeCom)**.
O assistente encontra a consulta certa no catálogo, pede aprovação, solicita as credenciais
do usuário de integração, consulta a API e devolve a planilha (.xlsx).

## Fluxo

1. O cliente pergunta ("produtos cadastrados", "movimentos de estoque da matriz").
2. A IA responde usando o catálogo e indica a consulta, com método, caminho e colunas.
3. O cliente clica em **Executar esta consulta**.
4. Aparece um **formulário de credenciais** (e-mail, senha e endereço da API).
5. O servidor faz login no Sagi, pagina a consulta e devolve as linhas; a planilha é montada no navegador.

## Credenciais e segurança

- As credenciais do cliente ficam **na memória do navegador**, enquanto a aba estiver aberta.
  Vão ao servidor apenas no momento da consulta e **nunca** são enviadas ao modelo de IA,
  gravadas em disco ou registradas em log. O botão "Esquecer credenciais" limpa na hora.
- O cliente **nunca** deve digitar senha no campo de conversa — só no formulário.
- O assistente executa **somente leitura**. Nenhuma operação cria, altera ou cancela nada.
- Para o Sagi, crie um usuário dedicado à integração em *Menu Úteis > Controle de Usuários e
  Senhas > Cadastro de Usuários*, com e-mail preenchido e a opção "Bloquear Acesso ao SAGI
  Mobile" **desmarcada**.

## Chave da IA

A chave fica em variável de ambiente no servidor (no Lovable: Settings → Environment variables):

| Variável | Para quê |
|---|---|
| `ANTHROPIC_API_KEY` | chave da Anthropic (Claude), começa com `sk-ant-api03-` |
| `OPENAI_API_KEY` | alternativa |
| `MODELO_IA` | opcional, troca o modelo |

Nunca coloque a chave em arquivo do repositório: ele sincroniza com o GitHub.

## Como está montado

| Parte | Onde |
|---|---|
| Interface do chat | `src/routes/index.tsx` |
| Conversa com a IA (servidor) | `src/lib/assistente.servidor.ts` |
| Execução na API do cliente (servidor) | `src/lib/executor.servidor.ts` |
| Conhecimento gerado do catálogo | `src/lib/conhecimento.json` |
| Geração da planilha no navegador | `src/lib/planilha.ts` |
| Catálogo completo das APIs | `catalogo/` |

Para regerar o conhecimento (hoje limitado ao Sagi):

```sh
cd catalogo && .venv/Scripts/python scripts/gerar_conhecimento.py --sistemas sygecom
```

Sem `--sistemas`, entram os 10 sistemas documentados.

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ceb1624d-2966-4683-8d20-f7a7088cccb2).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

<!-- sync -->
