import Database from 'better-sqlite3'
import CryptoJS from 'crypto-js'
import path from "path"

export class DbManager {
  constructor() {
    this.encryptionKey = process.env.ENCRYPTION_KEY
    if (!this.encryptionKey) {
      throw new Error('ENCRYPTION_KEY must be set')
    }
    const databasePath = path.join(
      path.join(new URL('.', import.meta.url).pathname, '../../data'),
      'wallu_telegram.db'
    )
    this.db = new Database(databasePath)
    console.log(`Database connected to ${databasePath}`)
  }

  _encrypt(text) {
    return CryptoJS.AES.encrypt(text, this.encryptionKey).toString()
  }

  _decrypt(encryptedText) {
    const bytes = CryptoJS.AES.decrypt(encryptedText, this.encryptionKey)
    return bytes.toString(CryptoJS.enc.Utf8)
  }

  saveApiKey(apiKey, chatId, userId) {
    const encrypted = this._encrypt(apiKey)
    const upsertQuery = `
      INSERT INTO chat_configs (chat_id, api_key_encrypted, updated_by_user_id, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(chat_id) DO UPDATE SET api_key_encrypted  = excluded.api_key_encrypted,
                                         updated_by_user_id = excluded.updated_by_user_id,
                                         updated_at         = CURRENT_TIMESTAMP
    `
    this.db.prepare(upsertQuery).run(String(chatId), encrypted, String(userId))
    console.log(`Saved API key for chat ${chatId} updated by user ${userId}`)
  }

  getApiKeyFor(chatId) {
    const row = this.db
      .prepare('SELECT api_key_encrypted FROM chat_configs WHERE chat_id = ?')
      .get(String(chatId))
    if (row) {
      return this._decrypt(row.api_key_encrypted)
    }
    return null
  }

  deleteApiKey(chatId) {
    this.db
      .prepare('DELETE FROM chat_configs WHERE chat_id = ?')
      .run(String(chatId))
    console.log(`Deleted API key for chat ${chatId}`)
  }
}
