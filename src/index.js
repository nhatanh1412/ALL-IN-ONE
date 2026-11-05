'use strict';

require('dotenv').config();
const { Client, GatewayIntentBits, PermissionFlagsBits, SlashCommandBuilder, Events } = require('discord.js');
const { Pool } = require('pg');
const { migrate } = require('./database/migrations');
const warnings = require('./commands/admin/warnings');
const moderation = require('./commands/admin/moderation');

const SUPER_OWNER = '1329340429207863317';
if (!process.env.DISCORD_TOKEN || !process.env.DATABASE_URL) {
  console.error('Thiếu DISCORD_TOKEN hoặc DATABASE_URL trong môi trường.');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.on('error', (error) => console.error('Lỗi kết nối PostgreSQL:', error.message));
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const recentMessages = new Map();

const commands = [
  new SlashCommandBuilder().setName('help').setDescription('Xem các chức năng hiện có'),
  ...warnings.commands,
  ...moderation.commands,
  new SlashCommandBuilder().setName('whitelist').setDescription('Quản lý whitelist bảo mật của server')
    .addSubcommand((sub) => sub.setName('add').setDescription('Thêm người dùng').addUserOption((o) => o.setName('user').setDescription('Người dùng').setRequired(true)))
    .addSubcommand((sub) => sub.setName('remove').setDescription('Xóa người dùng').addUserOption((o) => o.setName('user').setDescription('Người dùng').setRequired(true)))
    .addSubcommand((sub) => sub.setName('list').setDescription('Xem whitelist')),
];

client.once(Events.ClientReady, async () => {
  try {
    await client.application.commands.set(commands.map((command) => command.toJSON()));
    console.log(`Đã đăng nhập: ${client.user.tag}`);
    console.log('KODARI_READY');
  } catch (error) {
    console.error('Không thể đăng ký lệnh:', error.message);
    process.exitCode = 1;
    client.destroy();
    await pool.end();
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  try {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: 'Lệnh này chỉ dùng trong server.', ephemeral: true });
      return;
    }
    if (interaction.commandName === 'help') {
      await interaction.reply({ content: 'Hiện có: /warn, /warnings, /timeout, /kick, /ban, /whitelist add, remove, list và chống spam cơ bản. Các module khác chưa được triển khai.', ephemeral: true });
      return;
    }
    if (await warnings.handle(interaction, pool)) return;
    if (await moderation.handle(interaction)) return;
    if (interaction.commandName !== 'whitelist') return;
    if (interaction.user.id !== SUPER_OWNER && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: 'Bạn cần quyền Administrator.', ephemeral: true });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    const action = interaction.options.getSubcommand();
    if (action === 'list') {
      const result = await pool.query('SELECT user_id FROM security_whitelist_users WHERE guild_id = $1 ORDER BY added_at LIMIT 100', [interaction.guildId]);
      const ids = [...new Set([SUPER_OWNER, ...result.rows.map((row) => row.user_id)])];
      await interaction.editReply({ content: `Whitelist (tối đa 100 mục lưu trong database):\n${ids.join('\n')}`, allowedMentions: { parse: [] } });
      return;
    }
    const user = interaction.options.getUser('user', true);
    if (action === 'add') {
      await pool.query('INSERT INTO security_whitelist_users (guild_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [interaction.guildId, user.id]);
      await interaction.editReply(`Đã thêm ${user.id} vào whitelist.`);
    } else if (user.id === SUPER_OWNER) {
      await interaction.editReply('Không thể xóa super owner khỏi whitelist.');
    } else {
      await pool.query('DELETE FROM security_whitelist_users WHERE guild_id = $1 AND user_id = $2', [interaction.guildId, user.id]);
      await interaction.editReply(`Đã xóa ${user.id} khỏi whitelist nếu có.`);
    }
  } catch (error) {
    console.error('Lỗi xử lý lệnh:', error.message);
    const payload = { content: 'Có lỗi xảy ra. Vui lòng thử lại sau.', ephemeral: true };
    try {
      if (interaction.deferred || interaction.replied) await interaction.editReply({ content: payload.content });
      else await interaction.reply(payload);
    } catch (replyError) { console.error('Không thể trả lời:', replyError.message); }
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (!message.inGuild() || message.author.bot || message.author.id === SUPER_OWNER) return;
  const key = `${message.guildId}:${message.author.id}`;
  const now = Date.now();
  const times = (recentMessages.get(key) || []).filter((time) => now - time < 10000);
  times.push(now);
  recentMessages.set(key, times);
  if (times.length <= 5) return;
  try {
    const result = await pool.query('SELECT 1 FROM security_whitelist_users WHERE guild_id = $1 AND user_id = $2', [message.guildId, message.author.id]);
    if (result.rowCount) return;
    if (message.deletable) await message.delete();
  } catch (error) { console.error('Không thể xử lý spam:', error.message); }
});

const cleanup = setInterval(() => {
  const cutoff = Date.now() - 10000;
  for (const [key, times] of recentMessages) {
    const active = times.filter((time) => time > cutoff);
    if (active.length) recentMessages.set(key, active);
    else recentMessages.delete(key);
  }
}, 30000);
cleanup.unref();
client.on(Events.Error, (error) => console.error('Lỗi Discord:', error.message));

async function start() {
  await migrate(pool);
  await client.login(process.env.DISCORD_TOKEN);
}
start().catch(async (error) => {
  console.error('Không thể khởi động:', error.message);
  client.destroy();
  await pool.end();
  process.exitCode = 1;
});