// ============================
// Barra Venezuela - Bot (Slash Commands)
// Moderación de Mecánicos + Facturación + Logs + Bienvenida/Despedida + Tickets
// ============================

require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  SlashCommandBuilder,
  Routes,
  REST,
  PermissionsBitField,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
} = require("discord.js");
const fs = require("fs");

// ---------------------------
// CLIENTE
// ---------------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,            // slash commands, guild
    GatewayIntentBits.GuildMembers,      // bienvenida/despedida, roles
    GatewayIntentBits.GuildMessages,     // logs, respuestas
    GatewayIntentBits.MessageContent,    // transcript/lectura si hiciera falta
  ],
});

// ---------------------------
// ANTI-CRASH
// ---------------------------
process.on("unhandledRejection", (err) => console.log("⚠️ Error no manejado:", err));
process.on("uncaughtException", (err) => console.log("💥 Excepción no controlada:", err));
process.on("multipleResolves", () => {});

// ---------------------------
// CONFIG (IDs)
// ---------------------------
const TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// Roles / Canales (de tu index original)
const mechanicRole = "1432854079914119317";
const adminRoles = [
  "1432854079947800688",
  "1432854079947800683",
  "1432854079947800685",
  "1432854079947800684",
];
const logsChannelId = "1432854081881509985";        // logs generales de servicio
const invoiceLogsChannelId = "1432854081881509984";  // logs de facturas

// STRIKES (nuevo /sancionar)
const STRIKE_1 = "1432854079914119308";
const STRIKE_2 = "1432854079565987992";
const STRIKE_3 = "1432854079565987991";
const SANCTIONS_CHANNEL_ID = "1432854081356955803";  // canal donde mandar el embed de sanción

// Bienvenidas/Despedidas (de tu index original)
const welcomeChannelId = "1432854079960514725"; // Canal de BIENVENIDA
const farewellChannelId = "1434727967719817227"; // Canal de DESPEDIDA
const civilRoleId = "1432854079565987987";      // Rol CIVIL

// Imagen/logo
const LOGO =
  "https://i.postimg.cc/90Jssfkg/26b87ec005339ffd79d27e6cf031b4f3.png";

// ---------------------------
// ESTADO EN MEMORIA (igual que tu index)
// ---------------------------
const serviceStart = {};     // timestamp de inicio por usuario
const totalServiceTime = {}; // acumulado por usuario
const invoices = {};         // facturas por usuario

// ---------------------------
// HELPERS
// ---------------------------
function hasMechanicRole(member) {
  return member.roles.cache.has(mechanicRole);
}
function hasAdminRole(member) {
  return member.roles.cache.some((r) => adminRoles.includes(r.id));
}
function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}h ${m}m ${s}s`;
}
function createErrorEmbed(msg) {
  return new EmbedBuilder()
    .setTitle("⚠️ Error")
    .setDescription(msg)
    .setColor("#FF5555")
    .setThumbnail(LOGO)
    .setFooter({ text: "Barra Venezuela - Bot" });
}

// ---------------------------
// COMMANDS (SLASH)
// ---------------------------
const commands = [
  // /servicio (toggle iniciar/finalizar con botón opcional)
  new SlashCommandBuilder()
    .setName("servicio")
    .setDescription("Inicia o finaliza tu turno de trabajo (mecánicos)"),

  // /facturar
  new SlashCommandBuilder()
    .setName("facturar")
    .setDescription("Registra una factura con captura obligatoria (mecánicos)")
    .addStringOption((o) =>
      o.setName("numero").setDescription("Número de factura").setRequired(true)
    )
    .addNumberOption((o) =>
      o.setName("precio").setDescription("Monto de la factura").setRequired(true)
    )
    .addAttachmentOption((o) =>
      o
        .setName("captura")
        .setDescription("Captura de la factura PAGADA (imagen obligatoria)")
        .setRequired(true)
    ),

  // /verhoras
  new SlashCommandBuilder()
    .setName("verhoras")
    .setDescription("Ver horas acumuladas")
    .addUserOption((o) =>
      o.setName("usuario").setDescription("Usuario a consultar (opcional)")
    ),

  // /verfacturas
  new SlashCommandBuilder()
    .setName("verfacturas")
    .setDescription("Ver facturas registradas")
    .addUserOption((o) =>
      o.setName("usuario").setDescription("Usuario a consultar (opcional)")
    ),

  // /resetfichajes
  new SlashCommandBuilder()
    .setName("resetfichajes")
    .setDescription("Resetea todos los fichajes (solo jefes)"),

  // /resetfacturas
  new SlashCommandBuilder()
    .setName("resetfacturas")
    .setDescription("Resetea todas las facturas (solo jefes)"),

  // /precios
  new SlashCommandBuilder()
    .setName("precios")
    .setDescription("Muestra el catálogo de servicios y precios"),

  // /sancionar (nuevo)
  new SlashCommandBuilder()
    .setName("sancionar")
    .setDescription("Aplica Strike 1/2/3 (solo jefes) y registra en sanciones")
    .addUserOption((o) =>
      o.setName("usuario").setDescription("Usuario a sancionar").setRequired(true)
    )
    .addStringOption((o) =>
      o
        .setName("strike")
        .setDescription("Nivel de strike a aplicar")
        .setRequired(true)
        .addChoices(
          { name: "1 Strike", value: STRIKE_1 },
          { name: "2 Strike", value: STRIKE_2 },
          { name: "3 Strike", value: STRIKE_3 }
        )
    )
    .addStringOption((o) =>
      o.setName("motivo").setDescription("Motivo de la sanción").setRequired(true)
    ),

  // /help
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Muestra todos los comandos disponibles"),
];

const rest = new REST({ version: "10" }).setToken(TOKEN);
(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: commands,
    });
    console.log("✅ Comandos registrados correctamente.");
  } catch (err) {
    console.log("Error registrando comandos:", err);
  }
})();

// ---------------------------
// BIENVENIDAS Y DESPEDIDAS (mantener igual)
// ---------------------------
client.on("guildMemberAdd", async (member) => {
  try {
    // Asignar rol civil
    const role = member.guild.roles.cache.get(civilRoleId);
    if (role) {
      await member.roles.add(role).catch(() => {});
    }

    // Enviar bienvenida
    const guild = member.guild;
    const memberCount = guild.memberCount;
    const channel = guild.channels.cache.get(welcomeChannelId);
    if (channel) {
      const embed = new EmbedBuilder()
        .setTitle("🎉 ¡Bienvenido/a a Barra Venezuela!")
        .setDescription(
          `👋 ¡Hola ${member.user}! Disfrutá tu estadía en **${guild.name}**.\n` +
            `Actualmente somos **${memberCount}** miembros.`
        )
        .setColor("#43B581")
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: "Barra Venezuela - Bot" });
      await channel.send({ embeds: [embed] });
    }
  } catch (err) {
    console.error("Error en bienvenida:", err);
  }
});

client.on("guildMemberRemove", async (member) => {
  try {
    const guild = member.guild;
    const memberCount = guild.memberCount;
    const channel = guild.channels.cache.get(farewellChannelId);
    if (channel) {
      const embed = new EmbedBuilder()
        .setTitle("😢 Miembro salió del servidor")
        .setDescription(
          `**${member.user.tag}** ha dejado **${guild.name}**.\n` +
            `Ahora somos **${memberCount}** miembros. ¡Que vuelva pronto!`
        )
        .setColor("#F04747")
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: "Barra Venezuela - Bot" });
      await channel.send({ embeds: [embed] });
    }
  } catch (err) {
    console.error("Error en despedida:", err);
  }
});

// ---------------------------
//
// INTERACCIONES (Slash Commands)
// ---------------------------
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, member, options, guild } = interaction;

  // "Pensando..." para evitar Unknown interaction
  await interaction.deferReply({ ephemeral: false }).catch(() => {});
  try {
    // Permisos por comando
    const isMech = hasMechanicRole(member);
    const isBoss = hasAdminRole(member);

    // Logs channel (reutilizamos el tuyo)
    const logsChannel = guild.channels.cache.get(logsChannelId);

    if (commandName === "servicio") {
      if (!isMech)
        return interaction.editReply({
          embeds: [createErrorEmbed("🚫 Solo los mecánicos pueden usar este comando.")],
        });

      const userId = member.id;
      const now = Date.now();

      if (!serviceStart[userId]) {
        // Inicia servicio
        serviceStart[userId] = now;

        const finishButton = new ButtonBuilder()
          .setCustomId(`finishService_${userId}`)
          .setLabel("Finalizar Servicio")
          .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(finishButton);

        const embed = new EmbedBuilder()
          .setTitle("🛠️ Servicio Iniciado")
          .setDescription("🔧 Has comenzado tu turno en **Barra Venezuela**.")
          .setColor("#43B581")
          .setThumbnail(LOGO)
          .addFields({ name: "🕒 Hora de inicio", value: `<t:${Math.floor(now / 1000)}:F>` })
          .setFooter({ text: "Barra Venezuela - Bot" });

        await interaction.editReply({ embeds: [embed], components: [row] });

        if (logsChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle("🟢 Servicio Iniciado")
            .setDescription(`**${member.user.tag}** inició su servicio.`)
            .addFields({ name: "Hora de inicio", value: `<t:${Math.floor(now / 1000)}:F>` })
            .setColor("#43B581")
            .setThumbnail(LOGO)
            .setFooter({ text: "Log de servicios" });
          logsChannel.send({ embeds: [logEmbed] }).catch(() => {});
        }
      } else {
        // Finaliza servicio (toggle si no apretan botón)
        const startTime = serviceStart[userId];
        delete serviceStart[userId];
        const elapsed = Date.now() - startTime;
        totalServiceTime[userId] = (totalServiceTime[userId] || 0) + elapsed;

        const embed = new EmbedBuilder()
          .setTitle("🔧 Servicio Finalizado")
          .setDescription("🚙 Has terminado tu turno en **Barra Venezuela**.")
          .setColor("#F04747")
          .setThumbnail(LOGO)
          .addFields(
            { name: "⏳ Tiempo en este turno", value: formatTime(elapsed) },
            { name: "📊 Total acumulado", value: formatTime(totalServiceTime[userId] || 0) }
          )
          .setFooter({ text: "Barra Venezuela - Bot" });

        await interaction.editReply({ embeds: [embed], components: [] });

        if (logsChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle("🔴 Servicio Finalizado")
            .setDescription(`**${member.user.tag}** finalizó su servicio.`)
            .addFields(
              { name: "Tiempo en este turno", value: formatTime(elapsed) },
              { name: "Total acumulado", value: formatTime(totalServiceTime[userId] || 0) }
            )
            .setColor("#F04747")
            .setThumbnail(LOGO)
            .setFooter({ text: "Log de servicios" });
          logsChannel.send({ embeds: [logEmbed] }).catch(() => {});
        }
      }

      return;
    }

    if (commandName === "facturar") {
      if (!isMech)
        return interaction.editReply({
          embeds: [createErrorEmbed("🚫 Solo los mecánicos pueden facturar.")],
        });

      const numero = options.getString("numero", true);
      const precio = options.getNumber("precio", true);
      const captura = options.getAttachment("captura", true);

      if (!captura || !captura.contentType?.startsWith("image/")) {
        return interaction.editReply({
          embeds: [createErrorEmbed("📸 Debes adjuntar **una imagen** válida de la factura pagada.")],
        });
      }

      if (!invoices[member.id]) invoices[member.id] = [];
      invoices[member.id].push({ numero, precio, imageURL: captura.url });

      const embed = new EmbedBuilder()
        .setTitle("💰 Factura Registrada")
        .setDescription(`📄 Factura **#${numero}** por **$${Math.round(precio).toLocaleString("es-ES")}**`)
        .setImage(captura.url)
        .setColor("#7289DA")
        .setThumbnail(LOGO)
        .setFooter({ text: "Barra Venezuela - Facturación" });

      await interaction.editReply({ embeds: [embed] });

      const invCh = guild.channels.cache.get(invoiceLogsChannelId);
      if (invCh) {
        const fechaHora = new Date().toLocaleString("es-ES");
        const logEmbed = new EmbedBuilder()
          .setTitle("🧾 Factura Generada")
          .setDescription(`Factura registrada por <@${member.id}>`)
          .addFields(
            { name: "📄 Número", value: `${numero}`, inline: true },
            { name: "💵 Monto", value: `$${Math.round(precio).toLocaleString("es-ES")}`, inline: true },
            { name: "🕒 Fecha y Hora", value: `${fechaHora}`, inline: false }
          )
          .setImage(captura.url)
          .setColor("#7289DA")
          .setThumbnail(LOGO)
          .setFooter({ text: "Log de facturas" });
        invCh.send({ embeds: [logEmbed] }).catch(() => {});
      }
      return;
    }

    if (commandName === "verhoras") {
      const user = options.getUser("usuario") || member.user;
      const total = totalServiceTime[user.id] || 0;

      const embed = new EmbedBuilder()
        .setTitle("⏰ Horas de Servicio Totales")
        .setDescription(`📌 **${user.tag}** ha trabajado:`)
        .setColor("#00B0F4")
        .setThumbnail(user.displayAvatarURL())
        .addFields({ name: "🕒 Total acumulado", value: formatTime(total) })
        .setFooter({ text: "Barra Venezuela - Bot" });

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (commandName === "verfacturas") {
      const user = options.getUser("usuario") || member.user;
      const list = invoices[user.id] || [];
      if (list.length === 0) {
        return interaction.editReply({
          embeds: [createErrorEmbed(`📭 **${user.tag}** no tiene facturas registradas.`)],
        });
      }
      const total = list.reduce((s, f) => s + (f.precio || 0), 0);

      const embed = new EmbedBuilder()
        .setTitle("📜 Resumen de Facturas")
        .setDescription(`📌 Facturas de **${user.tag}**`)
        .setColor("#00B0F4")
        .setThumbnail(user.displayAvatarURL())
        .addFields(
          { name: "📄 Cantidad", value: `${list.length}`, inline: true },
          { name: "💵 Total", value: `$${Math.round(total).toLocaleString("es-ES")}`, inline: true }
        )
        .setFooter({ text: "Barra Venezuela - Bot" });

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (commandName === "resetfichajes") {
      if (!isBoss)
        return interaction.editReply({
          embeds: [createErrorEmbed("🚫 Solo jefes pueden usar este comando.")],
        });
      for (const k in serviceStart) delete serviceStart[k];
      for (const k in totalServiceTime) delete totalServiceTime[k];
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🔄 Fichajes Reseteados")
            .setDescription("🧹 Se reseteó el registro de servicio y horas acumuladas.")
            .setColor("#FAA61A")
            .setFooter({ text: "Barra Venezuela - Bot" }),
        ],
      });
      return;
    }

    if (commandName === "resetfacturas") {
      if (!isBoss)
        return interaction.editReply({
          embeds: [createErrorEmbed("🚫 Solo jefes pueden usar este comando.")],
        });
      for (const k in invoices) delete invoices[k];
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🔄 Facturas Reseteadas")
            .setDescription("🧹 Se han borrado todas las facturas registradas.")
            .setColor("#FAA61A")
            .setFooter({ text: "Barra Venezuela - Bot" }),
        ],
      });
      return;
    }

    if (commandName === "precios") {
      const embed = new EmbedBuilder()
        .setTitle("📋 Catálogo de Servicios y Precios - Barra Venezuela")
        .setDescription("Lista de precios de servicios más comunes.")
        .setColor("#00B0F4")
        .setThumbnail(LOGO)
        .addFields(
          {
            name: "🛠️ Reparaciones Generales",
            value: `
**• Reparación de Motor:** $${(5000).toLocaleString("es-ES")}
**• Reparación de Chasis:** $${(3500).toLocaleString("es-ES")}
**• Cambio de Ruedas (4):** $${(1200).toLocaleString("es-ES")}
**• Reparación de Rueda (1):** $${(400).toLocaleString("es-ES")}
**• Kit de Reparación Básico:** $${(800).toLocaleString("es-ES")}
`,
          },
          {
            name: "🚀 Tuning de Motor",
            value: `
**• Turbo Nivel 1:** $${(15000).toLocaleString("es-ES")}
**• Mejora de Frenos:** $${(8000).toLocaleString("es-ES")}
**• Mejora de Suspensión:** $${(7500).toLocaleString("es-ES")}
**• Mejora de Transmisión:** $${(9000).toLocaleString("es-ES")}
`,
          },
          {
            name: "🎨 Modificaciones Estéticas",
            value: `
**• Pintura (Sólido):** $${(4000).toLocaleString("es-ES")}
**• Pintura (Nacarado/Mate):** $${(6500).toLocaleString("es-ES")}
**• Alerón Básico:** $${(2500).toLocaleString("es-ES")}
**• Neones (Kit Completo):** $${(5000).toLocaleString("es-ES")}
**• Lunas Tintadas:** $${(1500).toLocaleString("es-ES")}
`,
          }
        )
        .setFooter({ text: "Precios sujetos a cambios" });

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (commandName === "sancionar") {
      if (!isBoss)
        return interaction.editReply({
          embeds: [createErrorEmbed("🚫 Solo jefes pueden usar este comando.")],
        });

      const target = options.getMember("usuario", true);
      const strikeRoleId = options.getString("strike", true);
      const motivo = options.getString("motivo", true);

      // Limpieza de strikes previos (si querés acumular, comentá estas 3 líneas)
      for (const s of [STRIKE_1, STRIKE_2, STRIKE_3]) {
        if (target.roles.cache.has(s)) await target.roles.remove(s).catch(() => {});
      }

      await target.roles.add(strikeRoleId).catch(() => {});
      const tipoTexto =
        strikeRoleId === STRIKE_1
          ? "⚠️ 1 Strike"
          : strikeRoleId === STRIKE_2
          ? "⛔ 2 Strike"
          : "🚨 3 Strike";

      const embed = new EmbedBuilder()
        .setColor("#ed4245")
        .setTitle("🚨 Sanción Aplicada")
        .addFields(
          { name: "👤 Usuario", value: `${target}`, inline: true },
          { name: "🧰 Jefe", value: `${member}`, inline: true },
          { name: "📄 Tipo", value: tipoTexto, inline: true },
          { name: "📝 Motivo", value: motivo, inline: false }
        )
        .setThumbnail(LOGO)
        .setFooter({ text: "Barra Venezuela - Sistema Disciplinario" });

      await interaction.editReply({ embeds: [embed] });

      // Enviar a canal de sanciones
      const sancCh = guild.channels.cache.get(SANCTIONS_CHANNEL_ID);
      if (sancCh) sancCh.send({ embeds: [embed] }).catch(() => {});
      return;
    }

    if (commandName === "help") {
      const embed = new EmbedBuilder()
        .setTitle("📜 Menú de Ayuda - Barra Venezuela")
        .setDescription("Lista de comandos disponibles (solo slash).")
        .setColor("#00B0F4")
        .setThumbnail(LOGO)
        .addFields(
          {
            name: "🔧 Mecánicos",
            value:
              "`/servicio` – Inicia/termina turno (botón para finalizar)\n" +
              "`/facturar numero precio captura` – Registra una factura (con imagen obligatoria)",
          },
          {
            name: "👑 Jefes",
            value:
              "`/verhoras [usuario]` – Ver horas acumuladas\n" +
              "`/verfacturas [usuario]` – Ver facturas registradas\n" +
              "`/resetfichajes` – Resetear todos los fichajes\n" +
              "`/resetfacturas` – Resetear todas las facturas\n" +
              "`/sancionar usuario strike motivo` – Aplicar strike (1/2/3) y log",
          },
          { name: "🧾 Otros", value: "`/precios` – Catálogo de servicios y precios" }
        )
        .setFooter({ text: "Barra Venezuela - Bot" });

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // fallback
    await interaction.editReply("❌ Acción desconocida.");
  } catch (err) {
    console.error("💥 Error en slash:", err);
    try {
      await interaction.editReply({
        embeds: [createErrorEmbed("Ocurrió un error procesando el comando.")],
      });
    } catch {}
  }
});

// ---------------------------
// BOTONES (Finalizar Servicio por jefes) — se mantiene igual
// ---------------------------
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  // Para cualquier botón, deferUpdate para evitar Unknown interaction
  await interaction.deferUpdate().catch(() => {});

  const [action, userId] = interaction.customId.split("_");
  if (action !== "finishService") return;

  try {
    if (!hasAdminRole(interaction.member)) {
      return interaction.followUp({
        embeds: [createErrorEmbed("🚫 No tienes permiso para finalizar el servicio de otro mecánico.")],
        ephemeral: true,
      }).catch(() => {});
    }

    const member = await interaction.guild.members.fetch(userId).catch(() => null);
    if (!member)
      return interaction.followUp({
        embeds: [createErrorEmbed("❌ No se encontró al usuario del turno.")],
        ephemeral: true,
      }).catch(() => {});

    if (!serviceStart[userId]) {
      return interaction.followUp({
        embeds: [createErrorEmbed("❌ Este mecánico no tiene un servicio en curso.")],
        ephemeral: true,
      }).catch(() => {});
    }

    const startTime = serviceStart[userId];
    delete serviceStart[userId];
    const elapsed = Date.now() - startTime;
    totalServiceTime[userId] = (totalServiceTime[userId] || 0) + elapsed;

    // Actualizar el mensaje con embed final
    const embed = new EmbedBuilder()
      .setTitle("🔧 Servicio Finalizado (Admin)")
      .setDescription(`🚙 El turno de **${member.displayName}** fue cerrado por un Jefe Mecánico.`)
      .setColor("#F04747")
      .setThumbnail(LOGO)
      .addFields(
        { name: "⏳ Tiempo en este turno", value: formatTime(elapsed) },
        { name: "📊 Total acumulado", value: formatTime(totalServiceTime[userId] || 0) }
      )
      .setFooter({ text: "Barra Venezuela - Bot" });

    try {
      await interaction.message.edit({ embeds: [embed], components: [] }).catch(() => {});
    } catch {}

    const logChannel = interaction.guild.channels.cache.get(logsChannelId);
    if (logChannel) {
      const logEmbedFinish = new EmbedBuilder()
        .setTitle("🔴 Servicio Finalizado (Admin)")
        .setDescription(`Turno de **${member.displayName}** cerrado por un Jefe Mecánico.`)
        .addFields(
          { name: "Tiempo en este turno", value: formatTime(elapsed), inline: false },
          { name: "Total acumulado", value: formatTime(totalServiceTime[userId] || 0), inline: false }
        )
        .setColor("#F04747")
        .setThumbnail(LOGO)
        .setFooter({ text: "Log de servicios" });
      logChannel.send({ embeds: [logEmbedFinish] }).catch(() => {});
    }
  } catch (err) {
    console.error("❌ Error en botón finishService:", err);
    interaction.followUp({
      embeds: [createErrorEmbed("Ocurrió un error al finalizar el servicio.")],
      ephemeral: true,
    }).catch(() => {});
  }
});

// ---------------------------
// SISTEMA DE TICKETS (dejamos tu archivo externo)
// ---------------------------
try {
  // Si tu sistema de tickets está en un archivo aparte, lo mantenemos:
  // Asegurate de que ticketSystem exporte una función que reciba el client
  require("./ticketSystem")(client);
} catch (e) {
  console.log("ℹ️ ticketSystem no encontrado o no cargado. Si no usas tickets en este bot, ignora este mensaje.");
}

// ---------------------------
// READY + LOGIN
// ---------------------------
client.once("ready", () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);
});
client.login(TOKEN);
