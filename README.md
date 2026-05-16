# Sistema Integrado de Ocorrência Escolar - EMEF Nossa Senhora de Fátima

Este projeto é um site real em React + Firebase para registrar, consultar, exportar e imprimir ocorrências escolares.

## O que o sistema faz

- Tela de login restrita.
- Acesso apenas para usuários cadastrados no Firebase Authentication.
- Perfis: Professor, Secretaria e Coordenação.
- Registro online de ocorrências pelo celular ou notebook.
- Consulta e filtros por aluno, turma e status.
- Histórico completo por aluno para imprimir e entregar aos pais.
- Documento impresso com mensagem explicativa e assinatura do pai, mãe ou responsável.
- Dados salvos no Firestore, permitindo acesso por várias pessoas da escola.
- Brasão oficial salvo em `public/logo-nsf.png`.

## Como rodar no computador

1. Instale o Node.js.
2. Abra a pasta do projeto no VS Code.
3. Rode:

```bash
npm install
npm run dev
```

## Como configurar o Firebase

1. Acesse o Firebase Console.
2. Crie um projeto.
3. Ative Authentication > Sign-in method > Email/Password.
4. Crie os usuários dos professores, secretaria e coordenação.
5. Ative Firestore Database.
6. Copie `.env.example` para `.env` e preencha com as chaves do Firebase.
7. Na coleção `users`, crie um documento para cada usuário com o ID igual ao UID do Authentication:

```json
{
  "name": "Nome do usuário",
  "email": "usuario@escola.com",
  "role": "Professor",
  "active": true
}
```

Use `role` como `Professor`, `Secretaria` ou `Coordenação`.

## Regras de segurança

O arquivo `firebase.rules` contém regras para permitir acesso apenas aos usuários cadastrados e ativos.

## Como publicar como site real

Depois de configurar o Firebase, você pode hospedar em:

- Firebase Hosting
- Vercel
- Netlify

Para Vercel ou Netlify, envie a pasta do projeto e configure as variáveis de ambiente do Firebase.
