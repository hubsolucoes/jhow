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

## Demonstração x produção

Sem configuração, o chat roda em **demonstração**: entende a pergunta, propõe a consulta
e gera uma planilha com dados fictícios no formato real de cada API.

Em **produção**, clique no ícone de configuração e informe o endereço do backend. Ele deve
aceitar `POST` com `{ pergunta, historico }` e responder:

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
