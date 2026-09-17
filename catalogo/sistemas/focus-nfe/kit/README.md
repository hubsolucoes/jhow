# Kit Focus NFe — Excel, Power BI, Python e Node

Neste kit você preenche **só as credenciais e o ambiente**. Todo o resto já está pronto.

## 1. O que preencher

| Onde | Chave | O que é | Onde obter |
|---|---|---|---|
| Aba **Config** (Excel), `00_Parametros_PowerBI.pq` (Power BI) ou `.env` (Python/Node) | `Ambiente` / `FOCUS_AMBIENTE` | `sandbox` (homologação, sem validade fiscal) ou `producao` | Comece **sempre** em `sandbox`. |
| | `Token` / `FOCUS_TOKEN` | Token da empresa, usado como usuário do HTTP Basic (a senha fica vazia) | Painel Focus NFe, no cadastro da empresa. Há um token para homologação e outro para produção: use o do ambiente escolhido. |
| | `Cnpj` / `FOCUS_CNPJ` | CNPJ da empresa, 14 dígitos sem pontuação | Cadastro da empresa. |
| Só Excel/Power BI | `UF` | UF para a consulta de municípios | Opcional. |
| Só Excel/Power BI | `Refs` | Referências (`ref`) de NF-e emitidas, separadas por vírgula | Opcional; são as refs que o seu sistema usou na emissão. |

A tabela completa está em `powerquery/Config_layout.md`.

## 2. Excel

1. Abra a planilha gerada (`FocusNFe.xlsx`) e preencha a coluna **Valor** da aba **Config**.
2. Clique em **Dados > Atualizar Tudo**. Se o Excel perguntar como acessar o conteúdo web, escolha **Anônimo**: a autenticação é feita pelo token da aba Config.
3. Cada assunto vira uma aba:
   - `NfeRecebidas`, `CteRecebidas`, `NfseNacionalRecebidas`: documentos emitidos contra o seu CNPJ. A empresa precisa ter o recebimento habilitado na Focus.
   - `StatusNfeEmitidas`: situação das NF-e cujas refs você listou em `Refs`.
   - `InutilizacoesNfe`: faixas de numeração inutilizadas.
   - `Empresas`: emitentes e validade do certificado. **Só funciona com `Ambiente = producao`** e com um token que tenha permissão de gestão de empresas.
   - `MunicipiosNfse`: municípios da UF e a situação da NFS-e na Focus.
   - `BackupsXml`: links dos ZIPs mensais de XML/DANFE (baixe a partir do dia 2 de cada mês).

Todas as consultas **só leem dados**. Nenhuma atualização emite, cancela ou altera nada na Focus NFe.

**Se der erro na atualização**
- *"As credenciais fornecidas para a fonte Web são inválidas"*: a Focus recusou o token (HTTP 401/403). Confira se o `Token` é do mesmo `Ambiente` e se o `Cnpj` está habilitado nesse token. O Excel mostra essa mensagem genérica porque o Power Query não deixa tratar 401/403 de outro jeito.
- *"HTTP 429"*: você passou do limite de 100 requisições por minuto ou fez várias tentativas com token errado, e a Focus bloqueou o IP por alguns segundos. Espere um minuto antes de atualizar de novo e não fique repetindo com o token errado.
- Na aba `StatusNfeEmitidas`, uma ref inexistente aparece com `status = erro_consulta` e o motivo em `mensagem_sefaz`, sem derrubar as demais.

## 3. Power BI

1. Importe os arquivos `.pq` como consultas em branco (Editor Avançado), usando como nome o nome do arquivo sem o número (ex.: `01_fnApi.pq` → `fnApi`).
2. No lugar de `00_Parametros.pq`, use `00_Parametros_PowerBI.pq` com o nome `Parametros`. O ideal é criar parâmetros do Power BI (Ambiente, Token, Cnpj, UF, Refs) e referenciá-los nesse arquivo.
3. Em **Configurações da fonte de dados**, deixe as URLs da Focus como **Anônimo**. No serviço do Power BI, se o teste de conexão falhar por causa do cabeçalho de autenticação, marque a opção para ignorar o teste de conexão.
4. Limite da API: **100 requisições por minuto por token**. Evite agendar atualizações muito frequentes e mantenha `Refs` curto.

## 4. Python

```bash
cd python
pip install requests
cp .env.example .env          # preencha
python cliente.py             # leituras de exemplo
python cliente.py --emitir-teste   # emite uma NF-e de teste (só em sandbox; pede confirmação)
```

`cliente.py` traz a classe `FocusNFe` com autenticação, retry em 429/5xx, paginação (offset e versão), emissão de NF-e/NFC-e/NFS-e com polling de status, cancelamento, carta de correção, inutilização, manifestação, webhooks e download de XML/DANFE. Toda escrita pede confirmação e mostra o ambiente, a menos que você passe `confirmar=True` no seu código.

## 5. Node / TypeScript

```bash
cd typescript
cp .env.example .env          # preencha
node --env-file=.env --experimental-strip-types cliente.ts      # Node 22.6+
# ou: npx tsx --env-file=.env cliente.ts
```

A classe `FocusNFe` tem os mesmos recursos da versão Python e usa `fetch` nativo.

## 6. Trocar de homologação para produção

1. Troque **ao mesmo tempo** `Ambiente` para `producao` e o `Token` pelo token de produção.
2. Confira no cadastro da empresa o certificado A1 válido, as séries e o próximo número. Para NFC-e, confira também o CSC de produção.
3. Faça uma primeira emissão controlada e confira o resultado antes de liberar para todos.

**Atenção:** em produção as notas têm validade fiscal. Cancelamento e inutilização são irreversíveis.

## 7. Segurança

- Não envie a planilha nem o `.env` com o token preenchido para outras pessoas, e não versione o `.env`.
- No Power BI, prefira parâmetros e, em servidores, um cofre de segredos.
- Se a empresa tiver vários CNPJs, use o token de cada empresa em vez de um token com poderes de gestão, sempre que possível.
- Se o token vazar, gere outro no painel da Focus NFe.
- A consulta `Empresas` não traz os tokens das empresas para a planilha. Mantenha assim.

## 8. Referências

- Documentação oficial: https://doc.focusnfe.com.br/reference/introducao
- Ambientes: https://doc.focusnfe.com.br/reference/ambiente
- Autenticação: https://doc.focusnfe.com.br/reference/autenticacao
- Ficha completa deste sistema: `../ficha.md`
