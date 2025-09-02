import TelegramBot from 'node-telegram-bot-api'
import axios from 'axios'
import { DbManager } from './db/database.js'
import 'dotenv/config' // load env vars

const WALLU_API_URL = 'https://api.wallubot.com/v1'

const WALLU_HELP_TEXT = `
👋 Hi! I'm Wallu, the chatbot for support. This is the telegram addon for Wallu.
🌐 Website: https://wallubot.com
    
How to setup:
1. Create a new API key here: https://panel.wallubot.com/addons 
2. Use /wallu_setup to configure the bot (admin only)
`

const db = new DbManager()

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true })

// Store setup states
const setupStates = new Map()

let botInfo = {}

// Wrapper for handlers to catch and log exceptions
function withErrorHandling(handler) {
  return async (...args) => {
    try {
      return await handler(...args)
    } catch (error) {
      console.error('Handler error:', error.stack || error)
    }
  }
}

bot.getMe()
  .then(data => {
    console.log('Bot info:', data)
    botInfo = data
  })
  .catch(error => {
    console.error('Error getting bot info:', error)
    // restart
    process.exit(1)
  })

bot.setMyCommands([
  { command: 'wallu_help', description: 'Help for the bot' },
  { command: 'wallu_setup', description: 'Configure the bot (admin only)' },
  { command: 'wallu_status', description: 'Check bot status (admin only)' },
  { command: 'wallu_remove', description: 'Remove configuration (admin only)' }
])
  .then(() => console.log('Commands set up successfully'))

// Helper function to check if user is admin
async function isAdmin(chatId, userId, verbose) {
  // always in private chats
  if (chatId === userId) return true
  try {
    const chatMember = await bot.getChatMember(chatId, userId)
    if (verbose) {
      console.log(`Chat member ${chatMember.user.username} status (userId=${userId}) in chat ${chatId}:`, chatMember.status)
    }
    return ['creator', 'administrator'].includes(chatMember.status)
  } catch (error) {
    console.error('Error checking admin status:', error)
    return false
  }
}

// Help command
bot.onText(/\/wallu_help/, withErrorHandling(async (msg) => {
  await sendMarkdownMessage(msg.chat.id, WALLU_HELP_TEXT)
}))
bot.onText(/\/help/, withErrorHandling(async (msg) => {
  await sendMarkdownMessage(msg.chat.id, WALLU_HELP_TEXT)
}))
// Setup command - Initiates API key setup via private message
bot.onText(/\/wallu_setup/, withErrorHandling(async (msg) => {
  const chatId = msg.chat.id
  const userId = msg.from.id

  if (!await isAdmin(chatId, userId, true)) {
    await bot.sendMessage(chatId, 'Only administrators can configure the bot.')
  } else if (msg.chat.type !== 'private') {
    const keyboard = {
      inline_keyboard: [[{
        text: 'Click to set Wallu API key (opens a private chat)',
        url: `https://t.me/${botInfo.username}?start=setup_${chatId}`
      }]]
    }
    await bot.sendMessage(chatId,
      'Please click the button below to configure the bot in a private chat:',
      { reply_markup: keyboard })
  } else {
    await startApiKeySetup(userId, chatId)
  }
}))

bot.onText(/\/start(?:\s+(.+))?/, withErrorHandling(async (msg, match) => {
  const chatId = msg.chat.id
  const parameter = match[1] // This will contain our setup_CHATID if it exists

  // Regular start command (no parameters)
  if (!parameter) {
    await bot.sendMessage(chatId, WALLU_HELP_TEXT)
    return
  }
  // Handle setup deep link
  if (parameter.startsWith('setup_')) {
    const targetChatId = parameter.replace('setup_', '')
    try {
      if (!await isAdmin(targetChatId, msg.from.id, true)) {
        await bot.sendMessage(chatId, 'You need to be an administrator in the target chat to configure the bot.')
        return
      }
      await startApiKeySetup(msg.from.id, targetChatId)
    } catch (error) {
      console.error('Error in deep link setup:', error)
      await bot.sendMessage(chatId, 'Failed to start setup. Please make sure I am a member of the target chat and try again.')
    }
  }
}))

// Handle private setup
async function startApiKeySetup(userId, targetChatId) {
  const keyboard = {
    inline_keyboard: [[
      { text: 'Cancel', callback_data: 'setup_cancel' }
    ]]
  }
  const chatName = userId === targetChatId ? "this private chat" : (await bot.getChat(targetChatId)).title
  await bot.sendMessage(userId, `
Please enter your Wallu API key to be used in ${chatName}.
You can create a new API key here: https://panel.wallubot.com/addons
`,
    { reply_markup: keyboard })
  setupStates.set(userId, {
    state: 'AWAITING_API_KEY',
    targetChatId
  })
}

async function ensureApiReachable(apiKey, contextString) {
  try {
    await axios.post(`${WALLU_API_URL}/on-message`, {}, { headers: { "X-API-Key": apiKey, } })
  } catch (error) {
    console.log('API returned status (checking reachability)', error.response.status)
    // this produce some 400 error, but we don't care about those as it's just invalid data
    if (error.response && [401, 403].includes(error.response.status)) {
      throw new Error(`Invalid API key supplied (${contextString})`)
    }
  }
}

bot.on('callback_query', withErrorHandling(async (query) => {
  const userId = query.from.id
  const chatId = query.message.chat.id

  if (query.data === 'setup_cancel') {
    setupStates.delete(userId)
    await bot.answerCallbackQuery(query.id)
    await bot.sendMessage(userId, 'Setup cancelled.')
  } else if (query.data === 'remove_confirm') {
    try {
      await db.deleteApiKey(chatId)
      await bot.answerCallbackQuery(query.id)
      await bot.sendMessage(chatId, '✅ Configuration has been removed successfully.')
    } catch (error) {
      console.error('Error removing configuration:', error)
      await bot.sendMessage(chatId, '❌ Failed to remove configuration. Please try again later.')
    }
  } else if (query.data === 'remove_cancel') {
    await bot.answerCallbackQuery(query.id)
    await bot.sendMessage(chatId, 'Configuration removal has been cancelled.')
  } else {
    console.log('Unknown callback query:', query)
  }
}))

// Handle private messages for setup
bot.on('message', withErrorHandling(async (msg) => {
  if (msg.text && msg.text.startsWith('/')) {
    console.log("Ignoring a slash command")
    return
  }
  const userId = msg.from.id
  const setupState = setupStates.get(userId)
  const chatId = msg.chat.id
  if (setupState && setupState.state === 'AWAITING_API_KEY') {
    try {
      const setupTargetChatId = setupState.targetChatId;
      const chatTitle = (await bot.getChat(setupTargetChatId)).title
      // Test we don't get 401 or 403 with the API key
      await ensureApiReachable(msg.text, `during setup by user ${userId}`)

      await db.saveApiKey(msg.text, setupTargetChatId, userId)
      const chatName = userId === chatId ? "this private chat" : chatTitle
      await bot.sendMessage(userId, `Wallu has been successfully configured for ${chatName}! ✅`)
      if (setupTargetChatId !== userId) {
        await bot.sendMessage(setupTargetChatId, `Wallu has been successfully configured for ${chatName}! ✅`)
      }
      setupStates.delete(userId)
    } catch (error) {
      console.error('Error saving API key:', error)
      await bot.sendMessage(userId,
        'Failed to save API key. Possibly invalid API key. Please try again.',
        {
          reply_markup: { inline_keyboard: [[{ text: 'Cancel', callback_data: 'setup_cancel' }]] }
        })
    }
    // Delete the message containing the API key
    await bot.deleteMessage(userId, msg.message_id)
    return
  }
  const messageText = msg.text;
  if (!messageText || messageText.trim() === '') {
    console.log(`Ignoring empty message from chat ${chatId}`)
    return
  }
  const isBotMentioned = messageText && (
    msg.reply_to_message?.from?.id === botInfo.id ||
    msg.text.includes(`@${botInfo.username}`) ||
    msg.chat.type === 'private'
  )
  if (msg.reply_to_message && !isBotMentioned) {
    console.log(`Ignoring reply message from chat ${chatId} (not mentioned)`)
    return
  }
  const chatTitle = (await bot.getChat(chatId)).title
  try {
    const apiKey = await db.getApiKeyFor(chatId)
    if (!apiKey) {
      console.log(`Ignoring, no API key set for chat ${chatId}`)
      return
    }
    // Skip messages older messages because (especially before the error handling) Telegram retries
    // if we are down/there's a bug, it may otherwise answer 20h old messages or something
    const messageAge = Date.now() - (msg.date * 1000)
    if (messageAge > 5 * 60 * 1000) {
      console.log(`Ignoring message older than 5 minutes (${Math.round(messageAge / 1000)}s old) from chat ${chatId}`)
      return
    }
    if (isBotMentioned) {
      await bot.sendChatAction(chatId, 'typing')
    }
    const response = await axios.post(`${WALLU_API_URL}/on-message`, {
      addon: {
        name: 'wallu-telegram',
        version: '1.0.0',
      },
      channel: {
        id: chatId.toString(),
        name: 'Telegram: ' + (chatTitle || 'private chat'),
      },
      user: {
        id: msg.from.id.toString(),
        username: msg.from.first_name || msg.from.username || 'Unknown',
        is_staff_member: await isAdmin(chatId, msg.from.id, false),
      },
      message: {
        id: `${chatId}-${msg.message_id}`,
        is_bot_mentioned: isBotMentioned,
        content: messageText,
      },
      configuration: {
        emoji_type: 'unicode',
        // The [[1]](https://google.com) type of links had hard time rendering on Telegram properly so let's just disable them for now
        include_sources: false,
      }
    }, {
      headers: {
        "X-API-Key": apiKey,
      }
    })

    if (response.data?.response?.message) {
      await sendMarkdownMessage(chatId, response.data.response.message, {
        reply_to_message_id: msg.message_id,
      })
      console.log(`Answered in chat ${chatId} (` + (chatTitle || 'private') + `)`)
    }
  } catch (error) {
    console.error('Error processing message:', error)
    // Only send error messages to admins
    if (await isAdmin(chatId, msg.from.id) && isBotMentioned) {
      await bot.sendMessage(chatId, 'Error processing message. Please check the API key configuration.')
    }
  }
}))

// Status command
bot.onText(/\/wallu_status/, withErrorHandling(async (msg) => {
  const chatId = msg.chat.id
  const userId = msg.from.id
  if (!await isAdmin(chatId, userId, true)) {
    await bot.sendMessage(chatId, 'Only administrators can check the status.')
    return
  }
  const apiKey = await db.getApiKeyFor(chatId)
  if (apiKey) {
    try {
      await ensureApiReachable(apiKey, `during setup by user ${userId}`)
      await bot.sendMessage(chatId,
        '✅ Bot is configured and active for this chat.\n\n' +
        'Use /wallu_setup to change configuration\n' +
        'Use /wallu_remove to remove configuration')
    } catch (err) {
      await bot.sendMessage(chatId,
        '❌ Bot has invalid Wallu API Key.\n\n' +
        'Administrators can use /wallu_setup to set a new API key.')
    }
  } else {
    await bot.sendMessage(chatId,
      '❌ Bot is not configured.\n\n' +
      'Administrators can use /wallu_setup to configure the bot.')
  }
}))

bot.onText(/\/wallu_remove/, withErrorHandling(async (msg) => {
  const chatId = msg.chat.id
  const userId = msg.from.id
  if (!await isAdmin(chatId, userId, true)) {
    await bot.sendMessage(chatId, 'Only administrators can remove the configuration.')
    return
  }
  const keyboard = {
    inline_keyboard: [[
      { text: 'Yes, remove configuration', callback_data: 'remove_confirm' },
      { text: 'Cancel', callback_data: 'remove_cancel' }
    ]]
  }
  await bot.sendMessage(chatId,
    'Are you sure you want to remove the bot\'s configuration for this chat?',
    { reply_markup: keyboard })
}))

async function sendMarkdownMessage(chatId, text, form = {}) {
  try {
    // "Markdown" or telegram whatever doesn't support links like [1](<https://google.com>) so replace the <> in those cases with regex manually her
    text = text.replace(/\(<(https?:\/\/[^)]+)>\)/g, '($1)')
    await bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown', // "MarkdownV2" is confusing ... so let's use the legacy "Markdown"
      ...form
    })
  } catch (error) {
    console.error('Error sending Markdown message:', error)
    // on 400 error try without markdown
    if (error.response && error.response.statusCode === 400) {
      await bot.sendMessage(chatId, text, form)
    }
  }
}
