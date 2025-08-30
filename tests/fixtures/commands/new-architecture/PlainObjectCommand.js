const { SlashCommandBuilder } = require('discord.js')

// Plain object command in new architecture directory
module.exports = {
  data: new SlashCommandBuilder()
    .setName('plainobjectinnewarch')
    .setDescription('Plain object command in new architecture'),
  execute: async (interaction) => {
    // Plain object implementation
  },
  cooldown: 0
}