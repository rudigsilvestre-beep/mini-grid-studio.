# Mini Grid Studio

Vitrine de arte automobilística premium.

Projeto estático em HTML, CSS e JavaScript. Publicação inicial demonstrativa; checkout desativado.


### Racing nº 57 — lista de lançamento
O modal usa `/api/launch-alerts`, com inscrições privadas na tabela `launch_subscribers`.
Para lançar: criar o produto real na vitrine e no catálogo com preço e fotos finais; no item de `assets/catalog.js`, adicionar `launchKey: 'racing-57'` e manter `sold` falso/ausente. Não marcar antes do produto estar comprável. Isso encerra o modal e libera o disparo. Em `/admin-pedidos.html`, entrar e clicar em ENVIAR AVISOS DE LANÇAMENTO (lotes de 15). O cron diário existente também processa pendências após a publicação. O aviso inclui o link do produto e cancelamento. Não há data de lançamento inventada.
Schema aplicado: `db/launch-alerts.sql`. A chave de serviço e o Gmail permanecem apenas no servidor.
