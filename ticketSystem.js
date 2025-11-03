const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  AttachmentBuilder,
} = require("discord.js");
const fs = require("fs");
const path = require("path");

// Roles del staff autorizados
const staffRoles = [
  "1432854079947800683", // admin
  "1432854079947800688", // jefe
  "1432854079947800685", // subjefe
  "1432854079947800684", // coordinador
];

// Categorías del servidor donde van los tickets
const ticketCategories = {
  fichajes: "1434733532797861968",
  reportar: "1434733397783085146",
  dudas: "1434733256464535677",
};

// Canal de logs donde se enviarán los transcripts
const logChannelId = "1434736517288427600";

module.exports = (client) => {
  // ======================== 🛡️ ANTI-CRASH ========================
  process.on("unhandledRejection", (reason) =>
    console.log("⚠️ Error no manejado:", reason)
  );
  process.on("uncaughtException", (err) =>
    console.log("💥 Excepción no controlada:", err)
  );
  process.on("multipleResolves", () => {});

  // ======================== 🎫 PANEL DE TICKETS ========================
  client.on("messageCreate", async (message) => {
    if (message.content === "!ticketpanel") {
      if (!staffRoles.some((r) => message.member.roles.cache.has(r)))
        return message.reply("🚫 No tienes permiso para usar este comando.");

      const embed = new EmbedBuilder()
        .setTitle("🎫 Ticket System")
        .setDescription("Seleccioná una categoría para abrir un ticket:")
        .addFields(
          { name: "🕓 Fichajes", value: "Control o corrección de horas" },
          { name: "🔧 Reportar a un mecánico", value: "Reportar faltas o irregularidades" },
          { name: "💬 Dudas / Soporte", value: "Consultas o ayuda general" }
        )
        .setColor("#00B0F4")
        .setFooter({ text: "Arepa Venezuela - Todos los derechos reservados." });

      const menu = new StringSelectMenuBuilder()
        .setCustomId("ticketSelect")
        .setPlaceholder("Selecciona una categoría...")
        .addOptions([
          { label: "Fichajes", value: "fichajes", emoji: "🕓" },
          { label: "Reportar a un mecánico", value: "reportar", emoji: "🔧" },
          { label: "Dudas / Soporte", value: "dudas", emoji: "💬" },
        ]);

      const row = new ActionRowBuilder().addComponents(menu);
      await message.channel.send({ embeds: [embed], components: [row] });
    }
  });

  // ======================== 🆕 CREAR TICKET ========================
  client.on("interactionCreate", async (interaction) => {
    try {
      if (!interaction.isStringSelectMenu()) return;
      if (interaction.customId !== "ticketSelect") return;

      const { guild, member, values } = interaction;
      const category = values[0];

      const categoryId = ticketCategories[category];
      if (!categoryId)
        return interaction.reply({
          content: "⚠️ No hay categoría configurada para este tipo de ticket.",
          ephemeral: true,
        });

      const channelName = `ticket-${category}-${member.user.username}`
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "");

      const channel = await guild.channels.create({
        name: channelName,
        type: 0,
        parent: categoryId,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          {
            id: member.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.AttachFiles,
              PermissionsBitField.Flags.ReadMessageHistory,
            ],
          },
          ...staffRoles.map((id) => ({
            id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.ManageMessages,
            ],
          })),
        ],
      });

      const embed = new EmbedBuilder()
        .setTitle("🎫 Ticket System")
        .setDescription(
          `¡Bienvenido/a! Un miembro del equipo te atenderá a la brevedad.\n\n👤 **Usuario:** ${member}\n📂 **Categoría:** ${category}`
        )
        .setColor("#00B0F4");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("closeTicket")
          .setLabel("Cerrar")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("claimTicket")
          .setLabel("Asumir Ticket")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("notifyUser")
          .setLabel("Notificar Usuario")
          .setStyle(ButtonStyle.Secondary)
      );

      await channel.send({
        content: `${staffRoles.map((id) => `<@&${id}>`).join(" ")}`,
        embeds: [embed],
        components: [row],
      });

      await interaction.reply({
        content: `✅ Ticket creado correctamente: ${channel}`,
        ephemeral: true,
      });
    } catch (err) {
      console.error("Error creando ticket:", err);
    }
  });

// ======================== 🎛️ BOTONES DE CONTROL ========================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const { customId, member, channel, guild } = interaction;

  try {
    // Solo staff autorizado
    if (!staffRoles.some((r) => member.roles.cache.has(r))) {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.deferReply({ flags: 64 }).catch(() => {});
        await interaction.editReply({
          content: "🚫 No tienes permiso para usar este botón.",
        }).catch(() => {});
      }
      return;
    }

    // Usuario dueño del ticket
    const ticketMember = channel.permissionOverwrites.cache.find(
      (po) =>
        po.allow.has(PermissionsBitField.Flags.ViewChannel) &&
        !staffRoles.includes(po.id) &&
        po.id !== guild.id
    );

    // Función segura de respuesta
    const safeUpdate = async (msg) => {
      try {
        if (!interaction.replied && !interaction.deferred)
          await interaction.deferUpdate().catch(() => {});
        if (msg) await channel.send(msg).catch(() => {});
      } catch (err) {
        console.log("⚠️ Error safeUpdate:", err);
      }
    };

    // ==========================================
    // 🗑️ Cerrar ticket
    // ==========================================
    if (customId === "closeTicket") {
      await safeUpdate("🗑️ Cerrando ticket en 5 segundos...");

      // Obtener mensajes
      const allMessages = [];
      let lastId;
      while (true) {
        const msgs = await channel.messages.fetch({
          limit: 100,
          before: lastId,
        });
        if (msgs.size === 0) break;
        allMessages.push(...msgs.values());
        lastId = msgs.last().id;
        if (msgs.size < 100) break;
      }

      const transcript = allMessages
        .reverse()
        .map(
          (m) =>
            `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${
              m.content || "(embed/archivo)"
            }`
        )
        .join("\n");

      const filePath = path.join(__dirname, `transcript-${channel.name}.txt`);
      fs.writeFileSync(filePath, transcript || "Sin mensajes en el ticket.");

      const logChannel = guild.channels.cache.get(logChannelId);
      if (logChannel) {
        const embedLog = new EmbedBuilder()
          .setTitle("🗂️ Ticket Cerrado")
          .setDescription(
            `📁 **Canal:** ${channel.name}\n👤 **Cerrado por:** ${member}\n🕒 ${new Date().toLocaleString()}`
          )
          .setColor("#ff4b4b");

        await logChannel
          .send({
            embeds: [embedLog],
            files: [new AttachmentBuilder(filePath)],
          })
          .catch(console.error);
      }

      fs.unlinkSync(filePath);
      setTimeout(() => channel.delete().catch(() => {}), 5000);
      return;
    }

    // ==========================================
    // 🎟️ Asumir ticket
    // ==========================================
    if (customId === "claimTicket") {
      await safeUpdate(`🎟️ Ticket asumido por ${member}`);
      return;
    }

    // ==========================================
    // 📢 Notificar Usuario
    // ==========================================
    if (customId === "notifyUser") {
      if (ticketMember) {
        await safeUpdate(
          `📢 **<@${ticketMember.id}>**, por favor respondé el ticket cuando puedas.`
        );
      } else {
        await safeUpdate(
          "📢 No se encontró al usuario del ticket para notificarlo."
        );
      }
      return;
    }
  } catch (err) {
    console.error("❌ Error en botón:", err);
  }
});

};
