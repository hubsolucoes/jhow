# Tabela `tbConfig` (aba Config)

Colunas: **Chave | Valor | Descricao**. Edite só a coluna **Valor**.

| Chave | Obrigatória? | Exemplo | Descrição |
|---|---|---|---|
| `Ambiente` | sim | `sandbox` | `sandbox` usa https://homologacao.focusnfe.com.br (sem validade fiscal); `producao` usa https://api.focusnfe.com.br. |
| `Token` | sim | `<<SEU_TOKEN_FOCUS_NFE>>` | Token da empresa no painel Focus NFe. Tem que ser do mesmo ambiente de `Ambiente`, senão a API responde 401. |
| `Cnpj` | sim para notas recebidas, inutilizações e backups | `<<CNPJ_DA_EMPRESA>>` | 14 dígitos, sem pontuação. |
| `UF` | não | `SP` | UF usada na consulta `MunicipiosNfse`. |
| `Refs` | não | `pedido123,pedido124` | Referências (`ref`) de NF-e emitidas, separadas por vírgula, para `StatusNfeEmitidas`. Cada uma gasta 1 requisição do limite de 100 por minuto. |

Consultas geradas, todas somente leitura: `NfeRecebidas`, `CteRecebidas`, `NfseNacionalRecebidas`, `StatusNfeEmitidas`, `InutilizacoesNfe`, `Empresas` (só em produção), `MunicipiosNfse` e `BackupsXml`.
