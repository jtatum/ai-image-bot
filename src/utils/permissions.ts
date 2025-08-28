import { ChatInputCommandInteraction, PermissionFlagsBits, GuildMember } from 'discord.js'
import logger from '@/config/logger.js'

export class PermissionManager {
  static hasPermission(member: GuildMember, permission: bigint): boolean {
    return member.permissions.has(permission)
  }

  static isAdmin(member: GuildMember): boolean {
    return this.hasPermission(member, PermissionFlagsBits.Administrator)
  }

  static isModerator(member: GuildMember): boolean {
    return (
      this.hasPermission(member, PermissionFlagsBits.ManageMessages) ||
      this.hasPermission(member, PermissionFlagsBits.ManageRoles) ||
      this.hasPermission(member, PermissionFlagsBits.ModerateMembers)
    )
  }

  static async checkCommandPermissions(
    interaction: ChatInputCommandInteraction,
    requiredPermissions: bigint[] = []
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Allow in DMs unless specifically restricted
    if (!interaction.guild) {
      return { allowed: true }
    }

    const member = interaction.member as GuildMember
    if (!member) {
      logger.warn(`Could not get member for user ${interaction.user.id}`)
      return { allowed: false, reason: 'Unable to verify permissions' }
    }

    // Check if user has any of the required permissions
    if (requiredPermissions.length > 0) {
      const hasRequiredPermission = requiredPermissions.some(permission =>
        this.hasPermission(member, permission)
      )

      if (!hasRequiredPermission) {
        return {
          allowed: false,
          reason: 'You do not have the required permissions to use this command',
        }
      }
    }

    return { allowed: true }
  }

  static async checkBotPermissions(
    interaction: ChatInputCommandInteraction,
    requiredBotPermissions: bigint[] = []
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (!interaction.guild) {
      return { allowed: true }
    }

    const botMember = interaction.guild.members.me
    if (!botMember) {
      return { allowed: false, reason: 'Bot is not a member of this guild' }
    }

    // Check if bot has required permissions
    if (requiredBotPermissions.length > 0) {
      const missingPermissions = requiredBotPermissions.filter(
        permission => !this.hasPermission(botMember, permission)
      )

      if (missingPermissions.length > 0) {
        return {
          allowed: false,
          reason: 'Bot is missing required permissions to execute this command',
        }
      }
    }

    return { allowed: true }
  }

  static getPermissionName(permission: bigint): string {
    const permissionNames = new Map<bigint, string>([
      [PermissionFlagsBits.Administrator, 'Administrator'],
      [PermissionFlagsBits.ManageGuild, 'Manage Server'],
      [PermissionFlagsBits.ManageRoles, 'Manage Roles'],
      [PermissionFlagsBits.ManageChannels, 'Manage Channels'],
      [PermissionFlagsBits.ManageMessages, 'Manage Messages'],
      [PermissionFlagsBits.ManageNicknames, 'Manage Nicknames'],
      [PermissionFlagsBits.KickMembers, 'Kick Members'],
      [PermissionFlagsBits.BanMembers, 'Ban Members'],
      [PermissionFlagsBits.ModerateMembers, 'Moderate Members'],
      [PermissionFlagsBits.ViewChannel, 'View Channel'],
      [PermissionFlagsBits.SendMessages, 'Send Messages'],
      [PermissionFlagsBits.ReadMessageHistory, 'Read Message History'],
      [PermissionFlagsBits.UseExternalEmojis, 'Use External Emojis'],
      [PermissionFlagsBits.AddReactions, 'Add Reactions'],
      [PermissionFlagsBits.AttachFiles, 'Attach Files'],
      [PermissionFlagsBits.EmbedLinks, 'Embed Links'],
    ])

    return permissionNames.get(permission) || 'Unknown Permission'
  }
}
