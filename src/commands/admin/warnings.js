'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder().setName('warn').setDescription('Cảnh cáo một thành viên')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) => option.setName('user').setDescription('Thành viên cần cảnh cáo').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Lý do cảnh cáo').setRequired(true).setMaxLength(500)),
  new SlashCommandBuilder().setName('warnings').setDescription('Xem cảnh cáo của người dùng')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) => option.setName('user').setDescription('Người dùng cần xem').setRequired(true)),
];

async function handle(interaction, pool) {
  if (!['warn', 'warnings'].includes(interaction.commandName)) return false;
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
    await interaction.reply({ content: 'Bạn cần quyền Moderate Members.', ephemeral: true });
    return true;
  }
  await interaction.deferReply({ ephemeral: true });
  const user = interaction.options.getUser('user', true);
  if (interaction.commandName === 'warnings') {
    const result = await pool.query(
      'SELECT id, moderator_id, reason, created_at FROM moderation_warnings WHERE guild_id = $1 AND user_id = $2 ORDER BY created_at DESC, id DESC LIMIT 10',
      [interaction.guildId, user.id],
    );
    const lines = result.rows.map((row) => `#${row.id} • <t:${Math.floor(row.created_at.getTime() / 1000)}:d> • Quản trị: ${row.moderator_id}\n${row.reason}`);
    const embed = new EmbedBuilder().setTitle(`Cảnh cáo của ${user.username}`)
      .setDescription(lines.length ? lines.join('\n\n').slice(0, 4096) : 'Chưa có cảnh cáo.')
      .setFooter({ text: 'Hiển thị tối đa 10 cảnh cáo gần nhất.' });
    await interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
    return true;
  }
  const reason = interaction.options.getString('reason', true).trim();
  if (!reason || user.bot || user.id === interaction.user.id || user.id === interaction.guild.ownerId) {
    await interaction.editReply('Lý do không được để trống; không thể cảnh cáo bot, chính bạn hoặc chủ server.');
    return true;
  }
  const target = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (!target) {
    await interaction.editReply('Người dùng không còn là thành viên server hoặc không thể tải thông tin thành viên.');
    return true;
  }
  const moderator = await interaction.guild.members.fetch(interaction.user.id);
  if (interaction.user.id !== interaction.guild.ownerId && moderator.roles.highest.comparePositionTo(target.roles.highest) <= 0) {
    await interaction.editReply('Bạn chỉ có thể cảnh cáo thành viên có vai trò thấp hơn mình.');
    return true;
  }
  const result = await pool.query(
    `INSERT INTO moderation_warnings (guild_id, user_id, moderator_id, reason, interaction_id)
     VALUES ($1, $2, $3, $4, $5) ON CONFLICT (interaction_id) DO NOTHING RETURNING id`,
    [interaction.guildId, user.id, interaction.user.id, reason, interaction.id],
  );
  await interaction.editReply(result.rowCount ? `Đã lưu cảnh cáo #${result.rows[0].id} cho ${user.id}.` : 'Cảnh cáo này đã được xử lý.');
  return true;
}

module.exports = { commands, handle };