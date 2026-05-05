// MISSIONS CONFIGURATION GUIDE
// ================================
// Este arquivo documenta como configurar as diferentes tipos de missões no missions.json

// TIPOS DE MISSÃO DISPONÍVEIS:
// 1. send_messages       - Contar mensagens enviadas
// 2. voice_minutes       - Contar minutos em voz
// 3. buy_item           - Contar itens comprados na loja
// 4. gain_xp            - Ganhar total de XP
// 5. reach_level        - Atingir um nível específico
// 6. send_emoji         - Enviar mensagens com emojis
// 7. react_message      - Reagir a mensagens com emojis customizados
// 8. send_specific_message - Enviar mensagens específicas (CUSTOMIZÁVEL)

// ================================
// EXEMPLO 1: Missão Simples (send_messages)
// ================================
{
  "id": 1,
  "description": "Mande 10 mensagens em qualquer canal",
  "descriptionEn": "Send 10 messages in any channel",
  "type": "send_messages",
  "target": 10,
  "xpReward": 100,
  "coinReward": 50,
  "itemRewardId": null,
  "requiredPlan": "hsbc",
  "active": true,
  "seasonal": false
}

// ================================
// EXEMPLO 2: Missão com Mensagem Específica Simples
// ================================
// Quando o usuário enviar exatamente "feliz natal" (case-insensitive),
// a missão progride em 1.
{
  "id": 6,
  "description": "Espalhe o espírito natalino, diga 'Feliz Natal!'",
  "descriptionEn": "Spread the Christmas spirit, say 'Merry Christmas!'",
  "type": "send_specific_message",
  "target": 5,
  "xpReward": 300,
  "coinReward": 150,
  "itemRewardId": null,
  "requiredPlan": "hsbc",
  "active": true,
  "seasonal": true,
  "season": "christmas",
  "specificConfig": {
    "message": "feliz natal",
    "messageEn": "merry christmas",
    "caseSensitive": false
  }
}

// ================================
// EXEMPLO 3: Missão com Múltiplas Opções
// ================================
// Quando o usuário enviar qualquer uma das palavras
// (separadas por |), a missão progride.
// Ex: "que incrível!" → progride
//     "isso é ótimo!" → progride
//     "muito legal" → progride
{
  "id": 10,
  "description": "Diga algo positivo! ('incrível', 'ótimo', 'legal')",
  "descriptionEn": "Say something positive! ('amazing', 'awesome', 'cool')",
  "type": "send_specific_message",
  "target": 3,
  "xpReward": 100,
  "coinReward": 50,
  "itemRewardId": null,
  "requiredPlan": "barclays",
  "active": true,
  "seasonal": false,
  "specificConfig": {
    "message": "incrível|ótimo|legal|bom",
    "messageEn": "amazing|awesome|cool|good",
    "caseSensitive": false
  }
}

// ================================
// COMO ADICIONAR NOVAS MISSÕES
// ================================

// PASSO 1: Defina o tipo de missão
// Escolha entre os tipos acima.

// PASSO 2: Se for send_specific_message:
// Adicione o campo "specificConfig" com:
//   - message: padrão em português (use | para múltiplas opções)
//   - messageEn: padrão em inglês (use | para múltiplas opções)
//   - caseSensitive: true/false (padrão: false)

// PASSO 3: Configure os outros campos:
//   - id: número único (incremente o maior ID + 1)
//   - description/descriptionEn: descrição da missão
//   - target: quantas vezes executar a ação
//   - xpReward/coinReward: recompensas
//   - requiredPlan: qual plano precisa (hsbc, barclays, deutsche, ubs)
//   - active: true/false
//   - seasonal: true/false (se true, adicione "season")

// PASSO 4: Se for seasonal, adicione:
//   - season: "christmas" | "halloween" | "easter" | etc

// ================================
// EXEMPLOS DE CONFIGURAÇÃO
// ================================

// Missão: Cumprimentar alguém
{
  "type": "send_specific_message",
  "specificConfig": {
    "message": "olá|oi|e aí",
    "messageEn": "hello|hi|hey",
    "caseSensitive": false
  }
}

// Missão: Mencionar "amor" ou "amar"
{
  "type": "send_specific_message",
  "specificConfig": {
    "message": "amor|amar|amo",
    "messageEn": "love|beloved|adore",
    "caseSensitive": false
  }
}

// Missão: Case-sensitive (exato)
{
  "type": "send_specific_message",
  "specificConfig": {
    "message": "SHOUTING",
    "messageEn": "SHOUTING",
    "caseSensitive": true
  }
}

// ================================
// NOTAS IMPORTANTES
// ================================
// - Sempre use | para separar múltiplas opções
// - O sistema procura por SUBSTRING (não exato)
//   Ex: "feliz natal" match em "Feliz Natal! 🎄"
// - Mensagens são processadas lowercase por padrão
// - Cada mensagem pode triggerar múltiplas missões
// - O progresso é incrementado por mensagem/ação
