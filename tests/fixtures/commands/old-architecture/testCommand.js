const { SlashCommandBuilder } = require('discord.js')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('testcommand')
    .setDescription('Test command for old architecture'),
  execute: async (interaction) => {
    // Test command implementation
  },
  cooldown: 5
}