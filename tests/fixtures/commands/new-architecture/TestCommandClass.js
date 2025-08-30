const { SlashCommandBuilder } = require('discord.js')

class TestCommandClass {
  data = new SlashCommandBuilder()
    .setName('testcommandclass')
    .setDescription('Test command class for new architecture')

  cooldown = 10

  async execute(interaction) {
    // Test command class implementation
  }
}

module.exports = TestCommandClass