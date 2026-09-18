# JHOW — Assistente de integrações

Chat em que o cliente pede, em português, a informação que precisa do sistema que usa
(ERP, meio de pagamento, emissor de nota). O assistente encontra a consulta certa no
catálogo, pede aprovação, executa e devolve os dados em planilha (.xlsx).

## Como está montado

| Parte | Onde |
|---|---|
| Interface do chat | `src/routes/index.tsx` |
| Motor da conversa e integração com o backend | `src/lib/assistente.ts` |
| Consultas da demonstração (recorte do catálogo) | `src/lib/catalogo-demo.ts` |
| Geração da planilha no navegador | `src/lib/planilha.ts` |
| Catálogo completo das APIs e executor | `catalogo/` |

## Ligando a IA

O assistente consulta um modelo **no servidor**. A chave nunca fica no código nem no navegador:
configure uma variável de ambiente no ambiente de execução (no Lovable, em Settings → Environment
variables; localmente, no shell antes de `bun run dev`):

| Variável | Para quê |
|---|---|
| `ANTHROPIC_API_KEY` | chave da Anthropic (Claude). Começa com `sk-ant-api03-` |
| `OPENAI_API_KEY` | alternativa, se preferir OpenAI |
| `MODELO_IA` | opcional, troca o modelo (padrão: `claude-sonnet-5` ou `gpt-4o-mini`) |

Sem nenhuma delas, o chat continua funcionando em modo demonstração.

**Nunca** coloque a chave em arquivo do repositório: ele é sincronizado com o GitHub.

## O conhecimento do assistente

`src/lib/conhecimento.json` é gerado do catálogo real e carregado **apenas no servidor**:

```sh
cd catalogo && .venv/Scripts/python scripts/gerar_conhecimento.py
```

Hoje são 10 sistemas, 271 consultas executáveis e 241 operações de escrita descritas. A cada
pergunta, só o recorte relevante vai para o modelo — o prompt não carrega o catálogo inteiro.

## Demonstração x produção

Sem configuração, o chat roda em **demonstração**: entende a pergunta, propõe a consulta
e gera uma planilha com dados fictícios no formato real de cada API.

Para **produção**, o código que conversa com um backend já existe em `src/lib/assistente.ts`
(`responderPeloBackend`), mas o campo de configuração foi retirado da tela até o backend existir.
O contrato previsto: `POST` com `{ pergunta, historico }` respondendo:

```json
{
  "resposta": "texto do assistente",
  "planilha": {
    "nomeArquivo": "cobrancas.xlsx",
    "titulo": "Cobranças — Asaas",
    "colunas": [{ "titulo": "Cliente", "chave": "cliente" }],
    "linhas": [{ "cliente": "Empresa X" }]
  }
}
```

As credenciais dos clientes e a chave da IA ficam **no backend**, nunca no navegador nem
neste repositório. O assistente executa somente consultas de leitura.

This project was built with [Lovable](https://lovable.dev).

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
