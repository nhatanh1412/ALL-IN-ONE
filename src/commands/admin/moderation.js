'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const permissions = {
  timeout: PermissionFlagsBits.ModerateMembers,
  kick: PermissionFlagsBits.KickMembers,
  ban: PermissionFlagsBits.BanMembers,
};

const commands = [
  new SlashCommandBuilder().setName('timeout').setDescription('Tạm hạn chế một thành viên')
    .setDefaultMemberPermissions(permissions.timeout)
    .addUserOption((o) => o.setName('user').setDescription('Thành viên').setRequired(true))
    .addIntegerOption((o) => o.setName('minutes').setDescription('Thời gian tính bằng phút (1–40320)').setRequired(true).setMinValue(1).setMaxValue(40320))
    .addStringOption((o) => o.setName('reason').setDescription('Lý do').setMaxLength(500)),
  new SlashCommandBuilder().setName('kick').setDescription('Đuổi một thành viên')
    .setDefaultMemberPermissions(permissions.kick)
    .addUserOption((o) => o.setName('user').setDescription('Thành viên').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Lý do').setMaxLength(500)),
  new SlashCommandBuilder().setName('ban').setDescription('Cấm một thành viên')
    .setDefaultMemberPermissions(permissions.ban)
    .addUserOption((o) => o.setName('user').setDescription('Thành viên').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Lý do').setMaxLength(500)),
];

async function handle(interaction) {
  const action = interaction.commandName;
  if (!Object.hasOwn(permissions, action)) return false;
  if (!interaction.memberPermissions?.has(permissions[action])) {
    await interaction.reply({ content: 'Bạn không có quyền thực hiện lệnh này.', ephemeral: true });
    return true;
  }

  await interaction.deferReply({ ephemeral: true });
  const user = interaction.options.getUser('user', true);
  if (user.id === interaction.user.id || user.id === interaction.guild.ownerId || user.id === interaction.client.user.id) {
    await interaction.editReply('Không thể xử lý chính bạn, chủ server hoặc bot này.');
    return true;
  }
  const target = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (!target) {
    await interaction.editReply('Không tìm thấy thành viên trong server.');
    return true;
  }
  const moderator = await interaction.guild.members.fetch(interaction.user.id);
  if (interaction.user.id !== interaction.guild.ownerId && moderator.roles.highest.comparePositionTo(target.roles.highest) <= 0) {
    await interaction.editReply('Bạn chỉ có thể xử lý thành viên có vai trò thấp hơn mình.');
    return true;
  }
  if (!(action === 'timeout' ? target.moderatable : action === 'kick' ? target.kickable : target.bannable)) {
    await interaction.editReply('Bot không có quyền hoặc vai trò đủ cao để xử lý thành viên này.');
    return true;
  }
  const reason = interaction.options.getString('reason')?.trim() || 'Không có lý do';
  const auditReason = `${interaction.user.tag} (${interaction.user.id}): ${reason}`.slice(0, 512);
  if (action === 'timeout') {
    const minutes = interaction.options.getInteger('minutes', true);
    await target.timeout(minutes * 60_000, auditReason);
    await interaction.editReply(`Đã timeout ${user.id} trong ${minutes} phút.`);
  } else if (action === 'kick') {
    await target.kick(auditReason);
    await interaction.editReply(`Đã đuổi ${user.id} khỏi server.`);
  } else {
    await target.ban({ reason: auditReason });
    await interaction.editReply(`Đã cấm ${user.id} khỏi server.`);
  }
  return true;
}

module.exports = { commands, handle };