# 🤝 ConectaDoa — Rede Solidária Comunitária

> **Conectando quem quer ajudar a quem mais precisa na sua região.**  
> Plataforma web desenvolvida como Projeto de Extensão Universitária em Análise e Desenvolvimento de Sistemas (ADS) para mapear pontos de arrecadação comunitária, destacar demandas urgentes e facilitar o contato direto entre doadores e instituições sociais.

---

## 🎯 Sobre o Projeto

Muitos cidadãos desejam doar alimentos, roupas e itens de higiene, mas não sabem quais instituições confiáveis existem perto de suas casas ou quais produtos estão realmente em falta. Por outro lado, pequenos projetos comunitários, igrejas e ONGs de bairro enfrentam dificuldades para divulgar suas campanhas emergenciais.

O **ConectaDoa** resolve esse problema oferecendo um painel público, leve e responsivo onde:
- **Doadores** filtram pontos de coleta por bairro, categoria ou urgência, visualizam a rota no mapa e iniciam contato direto pelo WhatsApp sem intermediários.
- **Instituições** cadastram seus pontos com validação automática de endereço e recebem confirmação instantânea, mantendo autonomia para editar ou remover suas próprias publicações.

---

## ✨ Funcionalidades Principais

- **Filtro Inteligente & Busca em Tempo Real:** Pesquisa sem diferenciação de acentos por bairro, nome da instituição ou item específico, além de filtros por categoria (*Alimentos*, *Roupas*, *Higiene*) e indicador de **Doações Urgentes**.
- **Dashboard de Impacto:** Contadores dinâmicos de pontos ativos e campanhas com alta carência.
- **Validação Geográfica & Automação (n8n):** Integração via Webhook com fluxo no **n8n** para validar a existência do endereço cadastrado na API do OpenStreetMap (*Nominatim*) e disparar notificações automáticas via WhatsApp.
- **Controle de Permissões (Criador & Admin):**
  - Ao cadastrar um ponto, o navegador do criador recebe uma chave criptográfica (`SHA-256`) que habilita os botões de **Editar** e **Excluir** exclusivamente para aquele autor.
  - **Modo Administrador** protegido por senha para moderação global dos cards publicados.
- **Página Institucional (`Sobre Nós`):** Apresentação dos objetivos, frentes de arrecadação e roadmap de metas sociais do projeto.

---

## 🛠️ Arquitetura e Tecnologias

O projeto foi construído priorizando desempenho, segurança e zero dependências pesadas no back-end:

- **Front-end:** HTML5 Semântico, Tailwind CSS (via CDN), Phosphor Icons e JavaScript Vanilla (`Fetch API`).
- **Back-end:** Node.js (v22.13+) utilizando exclusivamente módulos nativos (`node:http`, `node:sqlite`, `node:crypto`, `node:fs`).
- **Banco de Dados:** SQLite embutido (`WAL mode`) com criação automática de esquema e dados iniciais (*seed*).
- **Automação & Integrações:** Docker + n8n (Webhook, HTTP Request para OpenStreetMap Nominatim e integração WhatsApp).
- **Segurança:** Proteção contra XSS (escape de HTML), cabeçalhos `Content-Security-Policy` (CSP), `Rate Limiting` por IP e comparação segura de hashes (`timingSafeEqual`).

---

## 📂 Estrutura de Diretórios

```text
ConectaDoa/
├── public/
│   ├── index.html       # Página principal (listagem, filtros, modal de cadastro/edição)
│   └── sobre.html       # Página institucional (motivo, objetivos, galeria e metas)
├── data/                # Diretório onde o banco SQLite é gerado automaticamente
├── server.js            # Servidor HTTP nativo, API REST e integração com n8n
├── package.json         # Metadados e script de inicialização
├── .gitignore           # Arquivos ignorados no versionamento
└── README.md            # Documentação do projeto

```

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- **Node.js** versão `22.13` ou superior (necessário para o módulo nativo `node:sqlite`).
- *(Opcional)* **Docker** e **n8n** rodando na porta `5678` para validação geográfica e disparos de WhatsApp.

### Passo a passo

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/carluux/ConectaDoa.git
   cd ConectaDoa
   ```

2. **Inicie o servidor:**
   ```bash
   npm start
   ```
   *(Para definir uma senha personalizada de administrador no terminal antes de iniciar, use `ADMIN_TOKEN=sua_senha npm start` no Linux/Mac ou `$env:ADMIN_TOKEN="sua_senha"; npm start` no PowerShell).*

3. **Acesse no navegador:**
   - **Plataforma:** `[http://127.0.0.1:3000](http://127.0.0.1:3000)`
   - **Página Sobre Nós:** `[http://127.0.0.1:3000/sobre.html](http://127.0.0.1:3000/sobre.html)`

---

## 🔌 Endpoints da API REST

| Método | Rota | Descrição | Autenticação |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/pontos` | Lista pontos cadastrados (suporta `?busca=`, `?categoria=`, `?urgencia=`) | Pública |
| `POST` | `/api/pontos` | Valida dados, consulta o n8n e cadastra um novo ponto | Pública |
| `PUT` | `/api/pontos/:id` | Atualiza as informações de um ponto existente | Criador (`X-Chave-Edicao`) ou Admin |
| `DELETE` | `/api/pontos/:id` | Remove um ponto de coleta | Criador (`X-Chave-Edicao`) ou Admin |
| `POST` | `/api/admin/verificar` | Valida a senha mestra para ativar o Modo Administrador | Senha Admin |

---

## 🗺️ Roadmap e Metas Futuras

- [x] Lançamento da plataforma web com banco SQLite e API REST nativa.
- [x] Integração com n8n para verificação de endereços e notificação via WhatsApp.
- [x] Sistema de edição e exclusão protegido para autores e administradores.
- [ ] Mapa interativo com cálculo de distância via GPS do usuário.
- [ ] Painel público de transparência com indicadores mensais de doações recebidas.

---

## 👨‍💻 Autor

Desenvolvido por **Carlos Henrique Palma Ferreira**  
Estudante de Análise e Desenvolvimento de Sistemas (ADS) — Projeto de Extensão Universitária da Faculdade Anhanguera Santana.