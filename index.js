const { Client, GatewayIntentBits, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const client = new Client({
  intents: [
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent,
GatewayIntentBits.GuildMembers,
  ],
});

const prefix = 'av!';

const mechanicRole = '1432854079914119317'; 

const adminRoles = ['1432854079947800688', '1432854079947800683', '1432854079947800685', '1432854079947800684']; 

const logsChannelId = '1432854081881509985';
const invoiceLogsChannelId = '1432854081881509984';

const serviceStart = {};       // Guarda el timestamp de inicio de cada servicio.
const totalServiceTime = {};   // Guarda el tiempo total de servicio de cada usuario.
const invoices = {};           // Guarda las facturas de cada usuario.

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

function createErrorEmbed(msg) {
  return new EmbedBuilder()
    .setTitle('⚠️ Error')
    .setDescription(msg)
    .setColor('#FF5555')
    .setThumbnail('https://i.postimg.cc/90Jssfkg/26b87ec005339ffd79d27e6cf031b4f3.png')
    .setFooter({ text: 'Arepa Venezuela - Bot by:Eliann.lua' });
}

function hasMechanicRole(member) {
  return member.roles.cache.has(mechanicRole);
}

function hasAdminRole(member) {
  return member.roles.cache.some(role => adminRoles.includes(role.id));
}

client.on('messageCreate', (message) => {
  if (!message.content.startsWith(prefix) || message.author.bot) return;
  
  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // Comprobación de permisos para comandos de administrador
  if ((command === 'verfacturas' || command === 'verhoras' || command === 'resetfichajes' || command === 'resetfacturas') && !hasAdminRole(message.member)) {
    return message.channel.send({ embeds: [createErrorEmbed("🚫 No tienes permiso para usar este comando.")] });
  }
  
  // Comprobación de permisos para comandos de mecánico
  if ((command === 'servicio' || command === 'facturar') && !hasMechanicRole(message.member)) {
    return message.channel.send({ embeds: [createErrorEmbed("🚫 Solo los miembros con el rol mecánico pueden usar este comando.")] });
  }

  if (command === 'servicio') {
    const userId = message.author.id;
    const now = Date.now();
    
    if (!serviceStart[userId]) {
      serviceStart[userId] = now;
      
      const finishButton = new ButtonBuilder()
        .setCustomId(`finishService_${userId}`)
        .setLabel('Finalizar Servicio')
        .setStyle(ButtonStyle.Danger);
      const actionRow = new ActionRowBuilder().addComponents(finishButton);

      message.channel.send({
        embeds: [new EmbedBuilder()
          .setTitle('🛠️ Servicio Iniciado')
          .setDescription('🔧 Has comenzado tu turno en **Arepa Venezuela**.')
          .setColor('#43B581')
          .setThumbnail('https://i.postimg.cc/90Jssfkg/26b87ec005339ffd79d27e6cf031b4f3.png')
          .addFields({ name: '🕒 Hora de inicio', value: `<t:${Math.floor(now / 1000)}:F>`, inline: false })
          .setFooter({ text: '🚗 Arepa Venezuela - Bot by:Eliann.lua' })
        ],
        components: [actionRow]
      });
      
      const logChannel = client.channels.cache.get(logsChannelId);
      if (logChannel) {
        const logEmbedStart = new EmbedBuilder()
          .setTitle('🟢 Servicio Iniciado')
          .setDescription(`**${message.author.tag}** ha iniciado su servicio en Arepa Venezuela.`)
          .addFields({ name: 'Hora de inicio', value: `<t:${Math.floor(now / 1000)}:F>`, inline: false })
          .setColor('#43B581')
          .setThumbnail('https://i.postimg.cc/90Jssfkg/26b87ec005339ffd79d27e6cf031b4f3.png')
          .setFooter({ text: 'Log de servicios - By:Eliann.lua' });
        logChannel.send({ embeds: [logEmbedStart] });
      }
    } 
    else {
      const startTime = serviceStart[userId];
      delete serviceStart[userId];
      const elapsed = now - startTime;
      totalServiceTime[userId] = (totalServiceTime[userId] || 0) + elapsed;
      
      message.channel.send({
        embeds: [new EmbedBuilder()
          .setTitle('🔧 Servicio Finalizado')
          .setDescription('🚙 Has terminado tu turno en **Arepa Venezuela**.')
          .setColor('#F04747')
          .setThumbnail('https://i.postimg.cc/90Jssfkg/26b87ec005339ffd79d27e6cf031b4f3.png')
          .addFields(
            { name: '⏳ Tiempo en este turno', value: formatTime(elapsed), inline: false },
            { name: '📊 Total acumulado', value: formatTime(totalServiceTime[userId]), inline: false }
          )
          .setFooter({ text: '🚗 Arepa Venezuela - Bot by:Eliann.lua' })
        ]
      });
      
      const logChannel = client.channels.cache.get(logsChannelId);
      if (logChannel) {
        const logEmbedFinish = new EmbedBuilder()
          .setTitle('🔴 Servicio Finalizado')
          .setDescription(`**${message.author.tag}** ha finalizado su servicio en Arepa Venezuela.`)
          .addFields(
            { name: 'Tiempo en este turno', value: formatTime(elapsed), inline: false },
            { name: 'Total acumulado', value: formatTime(totalServiceTime[userId]), inline: false }
          )
          .setColor('#F04747')
          .setThumbnail('https://i.postimg.cc/90Jssfkg/26b87ec005339ffd79d27e6cf031b4f3.png')
          .setFooter({ text: 'Log de servicios - By:Eliann.lua' });
        logChannel.send({ embeds: [logEmbedFinish] });
      }
    }
  }
  
else if (command === 'facturar') {
  const userId = message.author.id;
  const numeroFactura = args[0];
  const precio = parseFloat(args[1]);
  const attachment = message.attachments.first();

  // Validaciones básicas
  if (!numeroFactura || isNaN(precio)) {
    return message.channel.send({ 
      embeds: [createErrorEmbed('❌ Uso incorrecto.\nEjemplo: `av!facturar <NúmeroFactura> <Precio>` y adjunta una captura de la factura.')]
    });
  }

  // Validación de imagen obligatoria
  if (!attachment || !attachment.contentType?.startsWith('image/')) {
    return message.channel.send({
      embeds: [createErrorEmbed('📸 Debes adjuntar una captura de la factura pagada para poder registrar la facturación.')]
    });
  }

  // Guardar factura en memoria
  if (!invoices[userId]) invoices[userId] = [];
  invoices[userId].push({ numeroFactura, precio, imageURL: attachment.url });

  // Confirmación al mecánico
  message.channel.send({
    embeds: [new EmbedBuilder()
      .setTitle('💰 Factura Registrada')
      .setDescription(`📄 Se registró la factura **#${numeroFactura}** por **$${Math.round(precio).toLocaleString('es-ES')}**.`)
      .setImage(attachment.url)
      .setColor('#7289DA')
      .setThumbnail('https://i.postimg.cc/90Jssfkg/26b87ec005339ffd79d27e6cf031b4f3.png')
      .setFooter({ text: '🛠️ Arepa Venezuela - Bot by:Eliann.lua' })
    ]
  });

  // Log en canal de facturas
  const invoiceLogChannel = client.channels.cache.get(invoiceLogsChannelId);
  if (invoiceLogChannel) {
    const fechaHora = new Date().toLocaleString('es-ES');
    const invoiceLogEmbed = new EmbedBuilder()
      .setTitle('🧾 Factura Generada')
      .setDescription(`Factura registrada por <@${message.author.id}>`)
      .addFields(
        { name: '📄 Número de Factura', value: `${numeroFactura}`, inline: true },
        { name: '💵 Monto', value: `$${Math.round(precio).toLocaleString('es-ES')}`, inline: true },
        { name: '🕒 Fecha y Hora', value: `${fechaHora}`, inline: false }
      )
      .setImage(attachment.url)
      .setColor('#7289DA')
      .setThumbnail('https://i.postimg.cc/90Jssfkg/26b87ec005339ffd79d27e6cf031b4f3.png')
      .setFooter({ text: 'Log de facturas - By:Eliann.lua' });

    invoiceLogChannel.send({ embeds: [invoiceLogEmbed] });
  }
}

  
  else if (command === 'verhoras') {
    const member = message.mentions.members.first() || message.guild.members.cache.get(args[0]) || message.member;
    const userId = member.id;
    const totalTime = totalServiceTime[userId] || 0;
    
    message.channel.send({
      embeds: [new EmbedBuilder()
        .setTitle('⏰ Horas de Servicio Totales')
        .setDescription(`📌 **${member.displayName}** ha trabajado un total de:`)
        .setColor('#00B0F4')
        .setThumbnail(member.user.displayAvatarURL())
        .addFields({ name: '🕒 Total acumulado', value: formatTime(totalTime), inline: false })
        .setFooter({ text: '🚗 Arepa Venezuela - Bot by:Eliann.lua' })
      ]
    });
  }
  
  else if (command === 'verfacturas') {
    const member = message.mentions.members.first() || message.guild.members.cache.get(args[0]) || message.member;
    const userId = member.id;

    if (!invoices[userId] || invoices[userId].length === 0) {
        return message.channel.send({ embeds: [createErrorEmbed(`📭 **${member.displayName}** no tiene facturas registradas.`)] });
    }

    const totalFacturas = invoices[userId].length;
    const totalPrecio = invoices[userId].reduce((sum, factura) => sum + factura.precio, 0);

    message.channel.send({
        embeds: [new EmbedBuilder()
            .setTitle('📜 Resumen de Facturas')
            .setDescription(`📌 Facturas de **${member.displayName}**`)
            .setColor('#00B0F4')
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
                { name: '📄 Cantidad de Facturas', value: `${totalFacturas}`, inline: true },
                { name: '💵 Total Facturado', value: `$${Math.round(totalPrecio).toLocaleString('es-ES')}`, inline: true }
            )
            .setFooter({ text: '🛠️ Arepa Venezuela - Bot by:Eliann.lua' })
        ]
    });
  }
  
  else if (command === 'resetfichajes') {
    for (const key in serviceStart) delete serviceStart[key];
    for (const key in totalServiceTime) delete totalServiceTime[key];
    
    message.channel.send({
      embeds: [new EmbedBuilder()
        .setTitle('🔄 Fichajes Reseteados')
        .setDescription('🧹 Todos los registros de servicio y las horas acumuladas han sido reseteados.')
        .setColor('#FAA61A')
        .setFooter({ text: '🚗 Arepa Venezuela - Bot by:Eliann.lua' })
      ]
    });
  }

else if (command === 'help') {
    const helpEmbed = new EmbedBuilder()
      .setTitle('📜 Menú de Ayuda - Arepa Venezuela')
      .setDescription('Aquí tienes una lista de todos los comandos disponibles.')
      .setColor('#00B0F4')
      .setThumbnail('https://i.postimg.cc/90Jssfkg/26b87ec005339ffd79d27e6cf031b4f3.png')
      .addFields(
        { 
          name: '🔧 Comandos para Mecánicos', 
          value: '`av!servicio` - Inicia o finaliza tu turno de trabajo.\n`av!facturar <N° Factura> <Precio>` - Registra una nueva factura.\n`av!precios` - Muestra el catálogo de servicios y precios.' 
        },
        { 
          name: '👑 Comandos para Jefes de Mecánicos (Admin)', 
          value: '`av!verhoras [miembro]` - Muestra las horas acumuladas de un mecánico.\n`av!verfacturas [miembro]` - Muestra el resumen de facturas de un mecánico.\n`av!resetfichajes` - Reinicia todas las horas de servicio.\n`av!resetfacturas` - Reinicia todas las facturas registradas.'
        }
      )
      .setFooter({ text: 'Arepa Venezuela - Bot by:Eliann.lua' });
      
    message.channel.send({ embeds: [helpEmbed] });
  }

  else if (command === 'precios' || command === 'catalogo') {
    const priceEmbed = new EmbedBuilder()
      .setTitle('📋 Catálogo de Servicios y Precios - Arepa Venezuela')
      .setDescription('Aquí tienes nuestra lista de precios para los servicios más comunes.')
      .setColor('#00B0F4')
      .setThumbnail('https://i.postimg.cc/90Jssfkg/26b87ec005339ffd79d27e6cf031b4f3.png')
      .addFields(
        { 
          name: '🛠️ Reparaciones Generales', 
          value: `
            **• Reparación de Motor:** $${(5000).toLocaleString('es-ES')}
            **• Reparación de Chasis:** $${(3500).toLocaleString('es-ES')}
            **• Cambio de Ruedas (4):** $${(1200).toLocaleString('es-ES')}
            **• Reparación de Rueda (1):** $${(400).toLocaleString('es-ES')}
            **• Kit de Reparación Básico:** $${(800).toLocaleString('es-ES')}
          `
        },
        { 
          name: '🚀 Tuning de Motor', 
          value: `
            **• Turbo Nivel 1:** $${(15000).toLocaleString('es-ES')}
            **• Mejora de Frenos:** $${(8000).toLocaleString('es-ES')}
            **• Mejora de Suspensión:** $${(7500).toLocaleString('es-ES')}
            **• Mejora de Transmisión:** $${(9000).toLocaleString('es-ES')}
          `
        },
        { 
          name: '🎨 Modificaciones Estéticas', 
          value: `
            **• Pintura (Color Sólido):** $${(4000).toLocaleString('es-ES')}
            **• Pintura (Nacarado/Mate):** $${(6500).toLocaleString('es-ES')}
            **• Alerón Básico:** $${(2500).toLocaleString('es-ES')}
            **• Neones (Kit Completo):** $${(5000).toLocaleString('es-ES')}
            **• Lunas Tintadas:** $${(1500).toLocaleString('es-ES')}
          `
        }
      )
      .setFooter({ text: 'Precios sujetos a cambios sin previo aviso. - Arepa Venezuela' });
      
    message.channel.send({ embeds: [priceEmbed] });
  }
  
  else if (command === 'resetfacturas') {
    for (const key in invoices) delete invoices[key];
    
    message.channel.send({
      embeds: [new EmbedBuilder()
        .setTitle('🔄 Facturas Reseteadas')
        .setDescription('🧹 Se han borrado todas las facturas registradas.')
        .setColor('#FAA61A')
        .setFooter({ text: '🚗 Arepa Venezuela - Bot by:Eliann.lua' })
      ]
    });
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const [action, userId] = interaction.customId.split('_');
  
  if (action === 'finishService') {
    const member = await interaction.guild.members.fetch(userId);
    const now = Date.now();

    if (!hasAdminRole(interaction.member)) {
      return interaction.reply({
        embeds: [createErrorEmbed('🚫 No tienes permiso para finalizar el servicio de otro mecánico.')],
        flags: 64
      });
    }

    if (!serviceStart[userId]) {
      return interaction.reply({
        embeds: [createErrorEmbed('❌ Este mecánico no tiene un servicio en curso.')],
        flags: 64
      });
    }

    const startTime = serviceStart[userId];
    delete serviceStart[userId];
    const elapsed = now - startTime;
    totalServiceTime[userId] = (totalServiceTime[userId] || 0) + elapsed;

    await interaction.update({
      content: `🚙 El turno de **${member.displayName}** ha sido cerrado por un Jefe Mecanico.`,
      embeds: [
        new EmbedBuilder()
          .setTitle('🔧 Servicio Finalizado')
          .setDescription(`🚙 El turno de **${member.displayName}** ha sido cerrado por un Jefe Mecanico.`)
          .setColor('#F04747')
          .setThumbnail('https://i.postimg.cc/90Jssfkg/26b87ec005339ffd79d27e6cf031b4f3.png')
          .addFields(
            { name: '⏳ Tiempo en este turno', value: formatTime(elapsed), inline: false },
            { name: '📊 Total acumulado', value: formatTime(totalServiceTime[userId]), inline: false }
          )
          .setFooter({ text: '🚗 Arepa Venezuela - Bot by:Eliann.lua' })
      ],
      components: [] 
    });
    
    const logChannel = client.channels.cache.get(logsChannelId);
    if (logChannel) {
      const logEmbedFinish = new EmbedBuilder()
        .setTitle('🔴 Servicio Finalizado (Admin)')
        .setDescription(`El turno de **${member.displayName}** ha sido cerrado por un Jefe Mecanico.`)
        .addFields(
          { name: 'Tiempo en este turno', value: formatTime(elapsed), inline: false },
          { name: 'Total acumulado', value: formatTime(totalServiceTime[userId]), inline: false }
        )
        .setColor('#F04747')
        .setThumbnail('https://i.postimg.cc/90Jssfkg/26b87ec005339ffd79d27e6cf031b4f3.png')
        .setFooter({ text: 'Log de servicios - By:Eliann.lua' });
      logChannel.send({ embeds: [logEmbedFinish] });
    }
  } else {
    // Evita conflicto con los botones o menús del sistema de tickets
    if (interaction.isButton() || interaction.isStringSelectMenu()) return;
    // Solo responde si es otro tipo de interacción
    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({
          content: '❌ Acción desconocida.',
          flags: 64,
        });
      } catch {}
    }
  }

  
});
// ======================= SISTEMA DE BIENVENIDAS Y DESPEDIDAS =======================

const welcomeChannelId = "1432854079960514725"; // Canal de BIENVENIDA
const farewellChannelId = "1434727967719817227"; // Canal de DESPEDIDA
const civilRoleId = "1432854079565987987"; // Rol CIVIL

// 🟢 Evento: Cuando alguien entra al servidor
client.on("guildMemberAdd", async (member) => {
  try {
    const guild = member.guild;
    const memberCount = guild.memberCount;

    // Asignar rol automáticamente
    const role = guild.roles.cache.get(civilRoleId);
    if (role) {
      await member.roles.add(role).catch((err) => {
        console.error(`No se pudo asignar el rol al nuevo miembro:`, err);
      });
    }

    // Crear el embed de bienvenida
    const embed = new EmbedBuilder()
      .setTitle("🎉 ¡Bienvenido/a a Arepa Venezuela!")
      .setDescription(`👋 ¡Hola ${member.user}! Esperamos que disfrutes tu estadía en **${guild.name}**.\n\nActualmente somos **${memberCount}** miembros en total.`)
      .setColor("#43B581")
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: "🚗 Arepa Venezuela - Bot by:Eliann.lua" });

    const channel = guild.channels.cache.get(welcomeChannelId);
    if (channel) await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("Error en bienvenida:", err);
  }
});

// 🔴 Evento: Cuando alguien se va del servidor
client.on("guildMemberRemove", async (member) => {
  try {
    const guild = member.guild;
    const memberCount = guild.memberCount;

    const embed = new EmbedBuilder()
      .setTitle("😢 ¡Un miembro ha dejado el servidor!")
      .setDescription(`**${member.user.tag}** ha salido de **${guild.name}**.\n\nEsperamos que vuelva pronto 💛\nAhora somos **${memberCount}** miembros.`)
      .setColor("#F04747")
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: "🚗 Arepa Venezuela - Bot by:Eliann.lua" });

    const channel = guild.channels.cache.get(farewellChannelId);
    if (channel) await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("Error en despedida:", err);
  }
});

require("./ticketSystem")(client);


require('dotenv').config();
client.login(process.env.BOT_TOKEN);
