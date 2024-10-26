# Wallu Telegram

A Telegram bot that integrates with [Wallu](https://wallubot.com) to provide intelligent support responses in your Telegram chats and groups. The bot uses
Wallu's API to process messages and generate helpful responses.

## Features

- 👥 Works in both private chats and group conversations
- 🤖 No need to mention the bot for responses (though you can mention it)
- ⚡ Easy setup process
- 🐳 Docker-based deployment

## Available Commands

- `/wallu_help` - Shows help information
- `/wallu_setup` - Configure the bot (admin only)
- `/wallu_status` - Check bot status (admin only)
- `/wallu_remove` - Remove configuration (admin only)

## Bot Configuration

1. Add the bot to your Telegram chat/group: [WalluChatBot](https://wallubot.com/telegram)
2. Get your Wallu API key from [panel.wallubot.com/addons](https://panel.wallubot.com/addons)
3. Use the `/wallu_setup` command to configure the bot (admin only)
4. Follow the bot's instructions to complete the setup

## Self-hosting Prerequisites

- Docker and Docker Compose installed on your system
- A Telegram Bot Token (get it from [@BotFather](https://t.me/BotFather))
- A Wallu API key (get it from [Wallu Panel](https://panel.wallubot.com/addons))

## Self-hosting Quick Start

1. Clone this repository

```bash
git clone https://github.com/yourusername/wallu-telegram
cd wallu-telegram
```

2. Set up environment variables

```bash
cp .env.example .env
```

3. Edit the `.env` file with your credentials:

```
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
# Use this to generate a new one: openssl rand -hex 16 
ENCRYPTION_KEY=dc038a7a3ef079e34d9825ffdbaab51b
```

<details>
  <summary>Why encryption key</summary>
Used to store the API key (and possibly other things in the future).
Yes, I know having it in .env next to the SQLite DB is not ideal (this feature is mainly meant for the Wallu's own production instance + avoid having the API keys unencrypted in backups)
</details>

4. Start the bot:
    - For development:
   ```bash
   ./start-dev.sh
   ```
    - For production:
   ```bash
   ./start-prod.sh
   ```

## Troubleshooting

**Bot not responding?**

- Check if the bot is properly configured using `/wallu_status`
- Ensure you've set up the Wallu API key correctly
- Verify that the bot has proper permissions in the group
- Contact for help: [Wallu Support](https://wallubot.com/contact)

## Support

If you encounter any issues:

- Visit [wallubot.com](https://wallubot.com) for general Wallu support
- Check the [Wallu documentation](https://docs.wallubot.com) for API-related questions
- Create an issue in this repository for bot-specific problems

## License

See the [LICENSE](LICENSE) file for license of this project.
